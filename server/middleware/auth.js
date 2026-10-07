import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../config/env.js";
import { User, Trip, TripMember } from "../models/index.js";
import { AppError, assert } from "../utils/errors.js";
export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.tripvero;
    assert(token, "Please sign in", 401);
    let claims;
    try {
      claims = jwt.verify(token, config.jwt, { algorithms: ["HS256"] });
    } catch {
      throw new AppError(401, "Your session expired. Please sign in again.");
    }
    const user = await User.findById(claims.sub).select("+tokenVersion");
    assert(
      user && user.tokenVersion === claims.ver,
      "Please sign in again",
      401,
    );
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
export async function tripAccess(req, res, next) {
  try {
    assert(mongoose.isValidObjectId(req.params.tripId), "Trip not found", 404);
    const [trip, member] = await Promise.all([
      Trip.findById(req.params.tripId),
      TripMember.findOne({ trip: req.params.tripId, user: req.user._id }),
    ]);
    assert(trip && member, "Trip not found or access denied", 404);
    req.trip = trip;
    req.member = member;
    next();
  } catch (e) {
    next(e);
  }
}
export const writeAccess = (req, res, next) => {
  try {
    assert(req.trip.status === "active", "Archived trips are read-only", 403);
    assert(req.member.role !== "viewer", "Viewers cannot make changes", 403);
    next();
  } catch (e) {
    next(e);
  }
};
export const adminAccess = (req, res, next) => {
  try {
    assert(
      ["owner", "admin"].includes(req.member.role),
      "Owner or admin access required",
      403,
    );
    next();
  } catch (e) {
    next(e);
  }
};
export const ownerAccess = (req, res, next) => {
  try {
    assert(req.member.role === "owner", "Only the owner can do this", 403);
    next();
  } catch (e) {
    next(e);
  }
};
export const editable = (req, record) =>
  assert(
    ["owner", "admin"].includes(req.member.role) ||
      String(record.createdBy) === String(req.user._id),
    "You can only change your own records",
    403,
  );
export function csrf(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      (origin && origin !== config.client) ||
      req.get("X-Tripvero-Request") !== "1"
    )
      return next(new AppError(403, "Request origin could not be verified"));
  }
  next();
}
