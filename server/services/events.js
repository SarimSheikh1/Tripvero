import { Activity, Notification, TripMember } from "../models/index.js";
export async function publish(req, text, type = "activity") {
  const activity = await Activity.create({
    trip: req.trip._id,
    user: req.user._id,
    text,
    kind: type,
  });
  const members = await TripMember.find({
    trip: req.trip._id,
    user: { $ne: req.user._id },
  }).populate("user", "settings");
  const notifications = await Notification.insertMany(
    members
      .filter((m) => m.user?.settings?.notifications !== false)
      .map((m) => ({ user: m.user._id, trip: req.trip._id, text, type })),
  );
  const io = req.app.get("io");
  io?.to(`trip:${req.trip._id}`).emit("trip:update", {
    tripId: String(req.trip._id),
    type,
  });
  for (const n of notifications)
    io?.to(`user:${n.user}`).emit("notification", n);
  return activity;
}
