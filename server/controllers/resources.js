import path from "node:path";
import {
  resources,
  Document,
  GalleryImage,
  Expense,
  Settlement,
  Accommodation,
  TripMember,
} from "../models/index.js";
import { parse, resourceSchemas } from "../utils/validation.js";
import { assert, id } from "../utils/errors.js";
import { editable } from "../middleware/auth.js";
import { saveFile, deleteStoredFile, uploadRoot } from "../services/storage.js";
import {
  transaction,
  validateMembers,
  memberIds,
} from "../services/transactions.js";
import { splitExpense } from "../services/finance.js";
import { publish } from "../services/events.js";
export async function list(req, res) {
  const Model = resources[req.params.resource];
  assert(Model, "Section not found", 404);
  const filter = { trip: req.trip._id };
  if (req.params.resource === "comments" && req.query.target)
    filter.target = req.query.target;
  const items = await Model.find(filter)
    .sort(
      req.params.resource === "itinerary"
        ? { date: 1, position: 1, time: 1 }
        : { createdAt: -1 },
    )
    .limit(500)
    .populate(
      req.params.resource === "activity" ? "user" : "createdBy",
      "name",
    );
  if (req.params.resource === "gallery")
    await GalleryImage.populate(items, { path: "document" });
  res.json(items);
}
export async function save(req, res) {
  const resource = req.params.resource,
    Model = resources[resource];
  assert(
    Model && resourceSchemas[resource],
    "This section cannot be edited here",
    404,
  );
  const data = parse(resourceSchemas[resource], req.body);
  let record;
  await transaction(req, async (session) => {
    if (["accommodations", "transport"].includes(resource))
      assert(
        ["owner", "admin"].includes(req.member.role),
        "Only owners and admins can manage bookings",
        403,
      );
    if (resource === "comments") {
      const targetModel = {
        expense: Expense,
        itinerary: resources.itinerary,
        activity: resources.activity,
      }[data.targetType];
      assert(
        await targetModel
          .exists({ _id: data.target, trip: req.trip._id })
          .session(session),
        "Comment target not found",
      );
    }
    if (data.assigned)
      await validateMembers(
        req.trip._id,
        Array.isArray(data.assigned) ? data.assigned : [data.assigned],
        session,
      );
    if (data.screenshot)
      assert(
        await Document.exists({
          _id: data.screenshot,
          trip: req.trip._id,
        }).session(session),
        "Booking file does not belong to this trip",
      );
    if (req.params.recordId) {
      record = await Model.findOne({
        _id: req.params.recordId,
        trip: req.trip._id,
      }).session(session);
      assert(record, "Record not found", 404);
      if (resource === "comments")
        assert(
          id(record.createdBy) === id(req.user),
          "Only the author can edit a comment",
          403,
        );
      else editable(req, record);
      assert(
        !record.expense || !data.createExpense,
        "A linked expense already exists",
      );
      Object.assign(record, data);
    } else
      record = new Model({
        ...data,
        trip: req.trip._id,
        createdBy: req.user._id,
      });
    if (resource === "accommodations")
      record.total =
        Math.ceil(
          (new Date(data.checkOut) - new Date(data.checkIn)) / 86400000,
        ) *
        data.rooms *
        data.roomPrice;
    if (data.createExpense) {
      const amount = resource === "accommodations" ? record.total : data.price;
      assert(amount > 0, "Cost must be positive to create an expense");
      const paidBy = data.paidBy || id(req.user);
      await validateMembers(req.trip._id, [paidBy], session);
      const personal = resource === "food" && !!data.personal;
      assert(
        !personal || paidBy === id(req.user),
        "Personal meals must be paid by you",
      );
      const participants = personal
        ? [id(req.user)]
        : await memberIds(req.trip._id, session);
      const details = participants.map((user) => ({ user }));
      const [expense] = await Expense.create(
        [
          {
            trip: req.trip._id,
            title: data.title,
            amount,
            category: {
              accommodations: "Accommodation",
              transport: data.type === "Fuel" ? "Fuel" : "Transport",
              food: "Food",
            }[resource],
            date: data.date || data.checkIn,
            paidBy: [{ user: paidBy, amount }],
            participants: splitExpense(amount, "equal", details),
            splitDetails: details,
            splitType: "equal",
            personal,
            createdBy: req.user._id,
          },
        ],
        { session },
      );
      record.expense = expense._id;
    }
    await record.save({ session });
  });
  await publish(
    req,
    `${req.user.name} ${req.params.recordId ? "updated" : "added"} ${data.title || "a comment"}.`,
    resource === "comments" ? "comment" : "planning",
  );
  res.status(req.params.recordId ? 200 : 201).json(record);
}
export async function remove(req, res) {
  const resource = req.params.resource,
    Model = resources[resource];
  assert(Model && resource !== "activity", "Section not found", 404);
  let filename;
  await transaction(req, async (session) => {
    const record = await Model.findOne({
      _id: req.params.recordId,
      trip: req.trip._id,
    }).session(session);
    assert(record, "Record not found", 404);
    if (["comments", "gallery"].includes(resource))
      assert(
        id(record.createdBy) === id(req.user) || req.member.role === "owner",
        "You can only delete your own content",
        403,
      );
    else editable(req, record);
    if (resource === "documents") {
      const inUse =
        (await Expense.exists({ receipt: record._id }).session(session)) ||
        (await Settlement.exists({ proof: record._id }).session(session)) ||
        (await Accommodation.exists({ screenshot: record._id }).session(
          session,
        )) ||
        (await GalleryImage.exists({ document: record._id }).session(session));
      assert(
        !inUse,
        "This file is attached to a record. Remove the attachment first.",
      );
      filename = record.filename;
    }
    if (resource === "gallery") {
      const doc = await Document.findById(record.document).session(session);
      filename = doc?.filename;
      await Document.deleteOne({ _id: record.document }, { session });
    }
    await record.deleteOne({ session });
  });
  if (filename) await deleteStoredFile(filename);
  await publish(req, `${req.user.name} deleted a ${resource} record.`);
  res.json({ message: "Deleted" });
}
export async function uploadDocument(req, res) {
  assert(
    ["documents", "gallery"].includes(req.params.resource),
    "Invalid upload section",
  );
  if (req.params.resource === "gallery")
    assert(
      req.file?.mimetype.startsWith("image/"),
      "Gallery uploads must be images",
    );
  const file = await saveFile(req.file);
  let doc, photo;
  try {
    await transaction(req, async (session) => {
      [doc] = await Document.create(
        [
          {
            ...file,
            trip: req.trip._id,
            createdBy: req.user._id,
            title: String(req.body.title || file.originalName).slice(0, 200),
            category: String(req.body.category || "Other").slice(0, 100),
          },
        ],
        { session },
      );
      if (req.params.resource === "gallery") {
        [photo] = await GalleryImage.create(
          [
            {
              trip: req.trip._id,
              createdBy: req.user._id,
              title: doc.title,
              document: doc._id,
              date: new Date(),
              caption: String(req.body.caption || "").slice(0, 2000),
            },
          ],
          { session },
        );
      }
    });
  } catch (e) {
    await deleteStoredFile(file.filename);
    throw e;
  }
  await publish(
    req,
    `${req.user.name} uploaded a ${photo ? "photo" : "document"}.`,
  );
  res.status(201).json(photo || doc);
}
export async function download(req, res) {
  const doc = await Document.findOne({
    _id: req.params.recordId,
    trip: req.trip._id,
  });
  assert(doc, "File not found", 404);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", doc.mime);
  res.setHeader(
    "Content-Disposition",
    `${req.query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
  );
  res.sendFile(path.join(uploadRoot, doc.filename), (error) => {
    if (error && !res.headersSent)
      res.status(404).json({ message: "File unavailable" });
  });
}
export async function reorder(req, res) {
  assert(
    Array.isArray(req.body.ids) && req.body.ids.length <= 500,
    "Invalid order",
  );
  await transaction(req, async (session) => {
    const items = await resources.itinerary
      .find({ trip: req.trip._id, _id: { $in: req.body.ids } })
      .session(session);
    assert(
      items.length === req.body.ids.length &&
        new Set(req.body.ids).size === items.length,
      "Invalid activities",
    );
    await resources.itinerary.bulkWrite(
      req.body.ids.map((item, i) => ({
        updateOne: {
          filter: { _id: item, trip: req.trip._id },
          update: { $set: { position: i } },
        },
      })),
      { session },
    );
  });
  await publish(req, "Itinerary order updated.");
  res.json({ message: "Order updated" });
}
export async function search(req, res) {
  const query = String(req.query.q || "").trim();
  assert(query.length >= 2 && query.length <= 100, "Enter 2–100 characters");
  const expression = {
    $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    $options: "i",
  };
  const result = [];
  for (const [section, Model] of Object.entries({
    expenses: Expense,
    ...resources,
  })) {
    if (["gallery", "comments", "activity"].includes(section)) continue;
    const items = await Model.find({
      trip: req.trip._id,
      $or: [
        "title",
        "notes",
        "location",
        "city",
        "destination",
        "provider",
        "description",
      ].map((key) => ({ [key]: expression })),
    }).limit(10);
    for (const item of items)
      result.push({ section, id: item._id, title: item.title });
  }
  const members = await TripMember.find({ trip: req.trip._id }).populate(
    "user",
    "name email",
  );
  for (const member of members)
    if (
      `${member.user.name} ${member.user.email}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      result.push({
        section: "members",
        id: member.user._id,
        title: member.user.name,
      });
  res.json(result);
}
