import mongoose from "mongoose";
import { Trip, TripMember } from "../models/index.js";
import { assert, id } from "../utils/errors.js";
export async function transaction(req, callback) {
  return mongoose.connection.transaction(async (session) => {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.trip._id, status: "active" },
      { $inc: { revision: 1 } },
      { new: true, session },
    );
    assert(trip, "Archived trips are read-only", 403);
    const member = await TripMember.findOne({
      trip: trip._id,
      user: req.user._id,
    }).session(session);
    assert(
      member && member.role !== "viewer",
      "Permission changed. Reload the trip.",
      403,
    );
    req.member = member;
    return callback(session, trip);
  });
}
export async function memberIds(tripId, session) {
  return (await TripMember.find({ trip: tripId }).session(session || null)).map(
    (m) => id(m.user),
  );
}
export async function validateMembers(tripId, ids, session) {
  const allowed = await memberIds(tripId, session);
  assert(
    ids.every((u) => allowed.includes(id(u))),
    "All participants and payers must belong to this trip",
  );
  return allowed;
}
