import { User, Trip, Expense } from "../models/index.js";
export function access(req, res, next) {
  if (req.user.role !== "admin")
    return res
      .status(403)
      .json({ message: "App administrator access required" });
  next();
}
export async function summary(req, res) {
  const day = new Date(Date.now() - 86400000),
    week = new Date(Date.now() - 7 * 86400000);
  const [
    registered,
    activeToday,
    activeWeek,
    newWeek,
    trips,
    expenses,
    loggedIn,
    recentUsers,
    logins,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActiveAt: { $gte: day } }),
    User.countDocuments({ lastActiveAt: { $gte: week } }),
    User.countDocuments({ createdAt: { $gte: week } }),
    Trip.countDocuments(),
    Expense.countDocuments(),
    User.countDocuments({ loginCount: { $gt: 0 } }),
    User.find()
      .select("name email role createdAt lastActiveAt lastLoginAt loginCount")
      .sort({ createdAt: -1 })
      .limit(100),
    User.aggregate([{ $group: { _id: null, total: { $sum: "$loginCount" } } }]),
  ]);
  res.json({
    registered,
    activeToday,
    activeWeek,
    newWeek,
    trips,
    expenses,
    loggedIn,
    totalLogins: logins[0]?.total || 0,
    recentUsers,
    measuredSince:
      "Usage tracking starts when this update is installed. Active users are signed-in users making API requests; anonymous visitors are not counted.",
  });
}
