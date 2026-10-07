import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Trip,
  TripMember,
  User,
  Expense,
  Settlement,
  Itinerary,
  Checklist,
  Accommodation,
  resources,
  Notification,
} from "../models/index.js";
import { parse, tripSchema } from "../utils/validation.js";
import { assert, id } from "../utils/errors.js";
import { analytics, ledger } from "../services/finance.js";
import { publish } from "../services/events.js";
import { transaction } from "../services/transactions.js";
import { sendMail } from "../services/email.js";
import { config } from "../config/env.js";
import { deleteStoredFile } from "../services/storage.js";
export async function list(req, res) {
  const memberships = await TripMember.find({ user: req.user._id }).populate(
    "trip",
  );
  const result = [];
  for (const m of memberships.filter((m) => m.trip)) {
    const expenses = await Expense.find({ trip: m.trip._id });
    const settlements = await Settlement.find({ trip: m.trip._id });
    const members = await TripMember.find({ trip: m.trip._id });
    const own = ledger(members, expenses, settlements).find(
      (r) => id(r.user) === id(req.user),
    );
    result.push({
      ...m.trip.toObject(),
      role: m.role,
      memberCount: members.length,
      spent: expenses.reduce((s, e) => s + e.amount, 0),
      own,
    });
  }
  res.json(result);
}
export async function create(req, res) {
  const data = parse(tripSchema, req.body);
  let trip;
  await mongoose.connection.transaction(async (session) => {
    [trip] = await Trip.create(
      [
        {
          ...data,
          owner: req.user._id,
          inviteCode: `TRIP-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        },
      ],
      { session },
    );
    await TripMember.create(
      [{ trip: trip._id, user: req.user._id, role: "owner" }],
      { session },
    );
  });
  res.status(201).json(trip);
}
export async function detail(req, res) {
  const tripId = req.trip._id;
  const [members, expenses, settlements, itinerary, checklist, accommodation] =
    await Promise.all([
      TripMember.find({ trip: tripId }).populate("user", "name email avatar"),
      Expense.find({ trip: tripId }).sort({ date: -1 }),
      Settlement.find({ trip: tripId }),
      Itinerary.find({ trip: tripId }),
      Checklist.find({ trip: tripId }),
      Accommodation.countDocuments({ trip: tripId }),
    ]);
  res.json({
    trip: req.trip,
    members,
    role: req.member.role,
    analytics: analytics(req.trip, members, expenses, settlements, {
      total: itinerary.length + checklist.length,
      completed: [...itinerary, ...checklist].filter((x) => x.completed).length,
      accommodation: accommodation > 0,
    }),
  });
}
export async function update(req, res) {
  const data = parse(tripSchema, req.body);
  let trip;
  await transaction(req, async (session) => {
    assert(
      ["owner", "admin"].includes(req.member.role),
      "Owner or admin access required",
      403,
    );
    trip = await Trip.findByIdAndUpdate(
      req.trip._id,
      { $set: data },
      { new: true, runValidators: true, session },
    );
  });
  await publish(req, `${req.user.name} updated the trip.`);
  res.json(trip);
}
export async function archive(req, res) {
  assert(["active", "archived"].includes(req.body.status), "Invalid status");
  const trip = await Trip.findByIdAndUpdate(
    req.trip._id,
    { $set: { status: req.body.status } },
    { new: true },
  );
  await publish(
    req,
    `${req.user.name} ${req.body.status === "archived" ? "archived" : "reopened"} the trip.`,
  );
  res.json(trip);
}
export async function remove(req, res) {
  assert(
    req.body.confirm === req.trip.name,
    "Type the trip name to confirm deletion",
  );
  const files = await resources.documents.find({ trip: req.trip._id });
  await mongoose.connection.transaction(async (session) => {
    await Trip.deleteOne({ _id: req.trip._id }, { session });
    for (const Model of new Set([
      TripMember,
      Expense,
      Settlement,
      ...Object.values(resources),
      Notification,
    ]))
      await Model.deleteMany({ trip: req.trip._id }, { session });
  });
  for (const file of files) await deleteStoredFile(file.filename);
  res.json({ message: "Trip deleted" });
}
export async function join(req, res) {
  const code = String(req.body.code || "")
    .trim()
    .toUpperCase();
  const trip = await Trip.findOne({ inviteCode: code, status: "active" });
  assert(trip, "Invitation is invalid or trip is archived", 404);
  await mongoose.connection.transaction(async (session) => {
    const locked = await Trip.findOneAndUpdate(
      { _id: trip._id, status: "active" },
      { $inc: { revision: 1 } },
      { new: true, session },
    );
    assert(locked, "Trip is archived");
    await TripMember.updateOne(
      { trip: trip._id, user: req.user._id },
      { $setOnInsert: { role: "member" } },
      { upsert: true, session },
    );
  });
  req.trip = trip;
  await publish(req, `${req.user.name} joined the trip.`, "member");
  res.json(trip);
}
export async function invite(req, res) {
  const link = `${config.client}/join?code=${req.trip.inviteCode}`;
  let delivery = { sent: false };
  if (req.body.email)
    delivery = await sendMail(
      String(req.body.email),
      "Join a trip on Tripvero",
      `${req.user.name} invited you to ${req.trip.name}. Join here: ${link}`,
    );
  res.json({ code: req.trip.inviteCode, link, ...delivery });
}
export async function rotateInvite(req, res) {
  const trip = await Trip.findByIdAndUpdate(
    req.trip._id,
    {
      $set: {
        inviteCode: `TRIP-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      },
    },
    { new: true },
  );
  res.json({ code: trip.inviteCode });
}
export async function addMember(req, res) {
  const user = await User.findOne({
    email: String(req.body.email || "")
      .toLowerCase()
      .trim(),
  });
  assert(
    user,
    "This person needs to register first; share the invitation link instead",
    404,
  );
  const role = req.body.role || "member";
  assert(["admin", "member", "viewer"].includes(role), "Invalid role");
  assert(
    req.member.role === "owner" || role !== "admin",
    "Only owners may appoint admins",
    403,
  );
  await transaction(req, async (session) => {
    assert(
      ["owner", "admin"].includes(req.member.role),
      "Owner or admin access required",
      403,
    );
    assert(
      req.member.role === "owner" || role !== "admin",
      "Only owners may appoint admins",
      403,
    );
    await TripMember.updateOne(
      { trip: req.trip._id, user: user._id },
      { $setOnInsert: { role } },
      { upsert: true, session },
    );
  });
  await publish(req, `${user.name} was added to the trip.`, "member");
  res.status(201).json({ message: "Member added" });
}
export async function changeMember(req, res) {
  assert(["admin", "member", "viewer"].includes(req.body.role), "Invalid role");
  await transaction(req, async (session) => {
    assert(req.member.role === "owner", "Only the owner can change roles", 403);
    const member = await TripMember.findOne({
      trip: req.trip._id,
      user: req.params.userId,
    }).session(session);
    assert(member && member.role !== "owner", "Cannot change the owner role");
    member.role = req.body.role;
    await member.save({ session });
  });
  const io = req.app.get("io");
  io?.in(`user:${req.params.userId}`).socketsLeave(`trip:${req.trip._id}`);
  io?.to(`user:${req.params.userId}`).emit("trip:update", {
    tripId: id(req.trip._id),
  });
  await publish(req, "A member role was updated.", "member");
  res.json({ message: "Role updated" });
}
export async function removeMember(req, res) {
  const target = req.params.userId;
  await transaction(req, async (session) => {
    const member = await TripMember.findOne({
      trip: req.trip._id,
      user: target,
    }).session(session);
    assert(
      member && member.role !== "owner",
      "The owner cannot leave; delete the trip instead",
    );
    assert(
      id(req.user) === target || ["owner", "admin"].includes(req.member.role),
      "Permission denied",
      403,
    );
    assert(
      req.member.role === "owner" ||
        member.role !== "admin" ||
        id(req.user) === target,
      "Only owner may remove an admin",
      403,
    );
    const linked = await Expense.exists({
      trip: req.trip._id,
      $or: [
        { "paidBy.user": target },
        { "participants.user": target },
        { createdBy: target },
      ],
    }).session(session);
    const settled = await Settlement.exists({
      trip: req.trip._id,
      $or: [{ from: target }, { to: target }],
    }).session(session);
    assert(
      !linked && !settled,
      "Members with financial history must remain for ledger integrity; change their role to viewer",
    );
    await member.deleteOne({ session });
  });
  req.app.get("io")?.in(`user:${target}`).socketsLeave(`trip:${req.trip._id}`);
  req.app
    .get("io")
    ?.to(`user:${target}`)
    .emit("trip:update", { tripId: id(req.trip._id) });
  await publish(req, "A member left the trip.", "member");
  res.json({ message: "Member removed" });
}
export async function budget(req, res) {
  const values = req.body.categoryBudgets;
  assert(
    values && typeof values === "object" && !Array.isArray(values),
    "Category budgets are required",
  );
  assert(Object.keys(values).length <= 50, "Too many categories");
  for (const [key, value] of Object.entries(values))
    assert(
      key.length > 0 &&
        key.length < 100 &&
        !/[.$]/.test(key) &&
        Number.isFinite(value) &&
        value >= 0,
      "Invalid category budget",
    );
  assert(
    Object.values(values).reduce((s, v) => s + v, 0) <= req.trip.budget,
    "Category budgets exceed the trip budget",
  );
  let trip;
  await transaction(req, async (session, current) => {
    assert(
      ["owner", "admin"].includes(req.member.role),
      "Owner or admin access required",
      403,
    );
    assert(
      Object.values(values).reduce((s, v) => s + v, 0) <= current.budget,
      "Category budgets exceed the trip budget",
    );
    trip = await Trip.findByIdAndUpdate(
      req.trip._id,
      { $set: { categoryBudgets: values } },
      { new: true, session },
    );
  });
  await publish(req, "Category budgets were updated.", "budget");
  res.json(trip);
}
