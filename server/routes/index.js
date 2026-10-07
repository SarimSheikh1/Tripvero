import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as auth from "../controllers/auth.js";
import * as trips from "../controllers/trips.js";
import * as finance from "../controllers/finance.js";
import * as records from "../controllers/resources.js";
import * as planning from "../controllers/planning.js";
import * as platformAdmin from "../controllers/admin.js";
import {
  authenticate,
  tripAccess,
  writeAccess,
  adminAccess,
  ownerAccess,
} from "../middleware/auth.js";
import { upload } from "../services/storage.js";
import { Notification } from "../models/index.js";
export const api = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});
api.get("/health", (req, res) => res.json({ status: "ok", app: "Tripvero" }));
api.post("/auth/register", authLimit, auth.register);
api.post("/auth/login", authLimit, auth.login);
api.post("/auth/forgot-password", authLimit, auth.forgot);
api.post("/auth/reset-password", authLimit, auth.reset);
api.use(authenticate);
api.get("/admin/summary", platformAdmin.access, platformAdmin.summary);
api.get("/auth/me", auth.me);
api.post("/auth/logout", auth.logout);
api.patch("/users/me", auth.profile);
api.patch("/users/me/language", async (req, res) => {
  if (!["en", "roman-ur"].includes(req.body.language))
    return res.status(400).json({ message: "Choose English or Roman Urdu" });
  await req.user.updateOne({ $set: { language: req.body.language } });
  res.json({ language: req.body.language });
});
api.post("/users/me/avatar", upload.single("file"), auth.avatar);
api.get("/users/:userId/avatar", auth.avatarFile);
api.get("/notifications", async (req, res) =>
  res.json(
    await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100),
  ),
);
api.patch("/notifications/read-all", async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id },
    { $set: { read: true } },
  );
  res.json({ message: "All read" });
});
api.patch("/notifications/:notificationId", async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.notificationId, user: req.user._id },
    { $set: { read: !!req.body.read } },
  );
  res.json({ message: "Updated" });
});
api.delete("/notifications/:notificationId", async (req, res) => {
  await Notification.deleteOne({
    _id: req.params.notificationId,
    user: req.user._id,
  });
  res.json({ message: "Deleted" });
});
api.get("/trips", trips.list);
api.post("/trips", trips.create);
api.post("/trips/join", trips.join);
const trip = Router({ mergeParams: true });
api.use("/trips/:tripId", tripAccess, trip);
trip.get("/", trips.detail);
trip.get("/choices", planning.list);
trip.post("/choices", writeAccess, planning.create);
trip.post("/choices/:choiceId/vote", writeAccess, planning.vote);
trip.delete("/choices/:choiceId", writeAccess, planning.remove);
trip.get("/members", async (req, res) =>
  res.json(
    await (
      await import("../models/index.js")
    ).TripMember.find({ trip: req.trip._id }).populate(
      "user",
      "name email avatar",
    ),
  ),
);
trip.get("/ledger", trips.detail);
trip.get("/reports", trips.detail);
trip.get("/budget", trips.detail);
trip.patch("/", writeAccess, adminAccess, trips.update);
trip.patch("/status", ownerAccess, trips.archive);
trip.delete("/", ownerAccess, trips.remove);
trip.post("/invite", writeAccess, adminAccess, trips.invite);
trip.post("/invite/rotate", writeAccess, ownerAccess, trips.rotateInvite);
trip.post("/members", writeAccess, adminAccess, trips.addMember);
trip.patch("/members/:userId", writeAccess, ownerAccess, trips.changeMember);
trip.delete("/members/:userId", writeAccess, trips.removeMember);
trip.patch("/budget", writeAccess, adminAccess, trips.budget);
trip.get("/search", records.search);
trip.get("/expenses", finance.expenseList);
trip.post("/expenses", writeAccess, finance.saveExpense);
trip.patch("/expenses/:recordId", writeAccess, finance.saveExpense);
trip.delete("/expenses/:recordId", writeAccess, finance.deleteExpense);
trip.get("/settlements", finance.settlementList);
trip.post("/settlements", writeAccess, finance.saveSettlement);
trip.delete("/settlements/:recordId", writeAccess, finance.deleteSettlement);
trip.post("/itinerary/reorder", writeAccess, records.reorder);
trip.get("/documents/:recordId/file", records.download);
trip.post(
  "/:resource/upload",
  writeAccess,
  upload.single("file"),
  records.uploadDocument,
);
trip.get("/:resource", records.list);
trip.post("/:resource", writeAccess, records.save);
trip.patch("/:resource/:recordId", writeAccess, records.save);
trip.delete("/:resource/:recordId", writeAccess, records.remove);
