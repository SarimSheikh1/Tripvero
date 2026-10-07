import { Expense, Settlement, Document, TripMember } from "../models/index.js";
import { parse, expenseSchema, settlementSchema } from "../utils/validation.js";
import { assert, cents, id } from "../utils/errors.js";
import { splitExpense, ledger } from "../services/finance.js";
import { transaction, validateMembers } from "../services/transactions.js";
import { editable } from "../middleware/auth.js";
import { publish } from "../services/events.js";
export async function validateExpense(req, data, session) {
  await validateMembers(
    req.trip._id,
    [
      ...data.paidBy.map((p) => p.user),
      ...data.splitDetails.map((p) => p.user),
    ],
    session,
  );
  assert(
    new Set(data.paidBy.map((p) => p.user)).size === data.paidBy.length,
    "Duplicate payers",
  );
  assert(
    data.paidBy.reduce((s, p) => s + cents(p.amount), 0) === cents(data.amount),
    "Payments must add up to the expense amount",
  );
  if (data.personal) {
    assert(
      data.splitDetails.length === 1 &&
        data.splitDetails[0].user === id(req.user),
      "Personal expenses can only belong to you",
    );
    assert(
      data.paidBy.length === 1 && data.paidBy[0].user === id(req.user),
      "Personal expenses must be paid by you",
    );
  }
  if (data.receipt)
    assert(
      await Document.exists({ _id: data.receipt, trip: req.trip._id }).session(
        session,
      ),
      "Receipt does not belong to this trip",
    );
  return {
    ...data,
    participants: splitExpense(data.amount, data.splitType, data.splitDetails),
  };
}
export async function expenseList(req, res) {
  const filter = { trip: req.trip._id };
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.member)
    filter.$or = [
      { "paidBy.user": req.query.member },
      { "participants.user": req.query.member },
    ];
  if (req.query.q)
    filter.$and = [
      {
        $or: ["title", "description", "notes"].map((key) => ({
          [key]: {
            $regex: String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        })),
      },
    ];
  if (req.query.personal) filter.personal = req.query.personal === "true";
  if (req.query.start || req.query.end)
    filter.date = {
      ...(req.query.start ? { $gte: new Date(req.query.start) } : {}),
      ...(req.query.end
        ? { $lte: new Date(`${req.query.end}T23:59:59.999Z`) }
        : {}),
    };
  if (req.query.min || req.query.max)
    filter.amount = {
      ...(req.query.min ? { $gte: Number(req.query.min) } : {}),
      ...(req.query.max ? { $lte: Number(req.query.max) } : {}),
    };
  const page = Math.max(1, Number(req.query.page) || 1),
    limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}
export async function saveExpense(req, res) {
  const data = parse(expenseSchema, req.body);
  let result;
  await transaction(req, async (session) => {
    const valid = await validateExpense(req, data, session);
    if (req.params.recordId) {
      result = await Expense.findOne({
        _id: req.params.recordId,
        trip: req.trip._id,
      }).session(session);
      assert(result, "Expense not found", 404);
      editable(req, result);
      Object.assign(result, valid);
      await result.save({ session });
    } else
      [result] = await Expense.create(
        [{ ...valid, trip: req.trip._id, createdBy: req.user._id }],
        { session },
      );
  });
  await publish(
    req,
    `${req.user.name} ${req.params.recordId ? "updated" : "added"} ${data.title} (${req.trip.currency} ${data.amount}).`,
    "expense",
  );
  res.status(req.params.recordId ? 200 : 201).json(result);
}
export async function deleteExpense(req, res) {
  await transaction(req, async (session) => {
    const record = await Expense.findOne({
      _id: req.params.recordId,
      trip: req.trip._id,
    }).session(session);
    assert(record, "Expense not found", 404);
    editable(req, record);
    await record.deleteOne({ session });
  });
  await publish(req, `${req.user.name} deleted an expense.`, "expense");
  res.json({ message: "Expense deleted" });
}
export async function settlementList(req, res) {
  res.json(await Settlement.find({ trip: req.trip._id }).sort({ date: -1 }));
}
export async function saveSettlement(req, res) {
  const data = parse(settlementSchema, req.body);
  let result;
  await transaction(req, async (session) => {
    await validateMembers(req.trip._id, [data.from, data.to], session);
    assert(
      ["owner", "admin"].includes(req.member.role) ||
        data.from === id(req.user),
      "You can only record your own outgoing payment",
      403,
    );
    if (data.proof)
      assert(
        await Document.exists({ _id: data.proof, trip: req.trip._id }).session(
          session,
        ),
        "Proof does not belong to this trip",
      );
    const members = await TripMember.find({ trip: req.trip._id }).session(
      session,
    );
    const expenses = await Expense.find({ trip: req.trip._id }).session(
      session,
    );
    const settlements = await Settlement.find({ trip: req.trip._id }).session(
      session,
    );
    const rows = ledger(members, expenses, settlements),
      from = rows.find((r) => id(r.user) === data.from),
      to = rows.find((r) => id(r.user) === data.to);
    assert(
      cents(data.amount) <= cents(Math.max(0, -from.balance)) &&
        cents(data.amount) <= cents(Math.max(0, to.balance)),
      "Payment exceeds the outstanding balance",
    );
    [result] = await Settlement.create(
      [{ ...data, trip: req.trip._id, createdBy: req.user._id }],
      { session },
    );
  });
  await publish(
    req,
    `${req.user.name} recorded a settlement of ${req.trip.currency} ${data.amount}.`,
    "settlement",
  );
  res.status(201).json(result);
}
export async function deleteSettlement(req, res) {
  await transaction(req, async (session) => {
    const record = await Settlement.findOne({
      _id: req.params.recordId,
      trip: req.trip._id,
    }).session(session);
    assert(record, "Settlement not found", 404);
    editable(req, record);
    await record.deleteOne({ session });
  });
  await publish(req, "A settlement was deleted.", "settlement");
  res.json({ message: "Settlement deleted" });
}
