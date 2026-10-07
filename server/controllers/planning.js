import { z } from "zod";
import { TripChoice, TripMember } from "../models/index.js";
import { parse } from "../utils/validation.js";
import { assert } from "../utils/errors.js";
const schema = z.object({
  kind: z.enum(["hotel", "bus", "car"]),
  name: z.string().trim().min(1).max(120),
  total: z.number().min(0).max(1e10),
  notes: z.string().max(1000).optional(),
});
export async function list(req, res) {
  res.json(
    await TripChoice.find({ trip: req.trip._id })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name"),
  );
}
export async function create(req, res) {
  res
    .status(201)
    .json(
      await TripChoice.create({
        ...parse(schema, req.body),
        trip: req.trip._id,
        createdBy: req.user._id,
      }),
    );
}
export async function vote(req, res) {
  const choice = await TripChoice.findOne({
    _id: req.params.choiceId,
    trip: req.trip._id,
  });
  assert(choice, "Option not found", 404);
  const votes = choice.votes.some((v) => String(v) === String(req.user._id));
  const updated = await TripChoice.findOneAndUpdate(
    { _id: choice._id, trip: req.trip._id },
    votes
      ? { $pull: { votes: req.user._id } }
      : { $addToSet: { votes: req.user._id } },
    { new: true },
  );
  res.json(updated);
}
export async function remove(req, res) {
  const choice = await TripChoice.findOne({
    _id: req.params.choiceId,
    trip: req.trip._id,
  });
  assert(choice, "Option not found", 404);
  assert(
    String(choice.createdBy) === String(req.user._id) ||
      ["owner", "admin"].includes(req.member.role),
    "Only the author or trip admin can remove this option",
    403,
  );
  await choice.deleteOne();
  res.json({ message: "Option removed" });
}
