import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import { config, validateConfig } from "./config/env.js";
import * as models from "./models/index.js";
import { deleteStoredFile } from "./services/storage.js";
validateConfig();
await mongoose.connect(config.mongo);
try {
  // Only the four former development accounts are targeted.
  const demos = await models.User.find({
    email: {
      $in: [
        "ali@tripvero.test",
        "ahmed@tripvero.test",
        "sarim@tripvero.test",
        "usman@tripvero.test",
      ],
    },
  });
  const ids = demos.map((u) => u._id),
    demoTrips = await models.Trip.find({ owner: { $in: ids } });
  const tripIds = demoTrips.map((t) => t._id);
  const realMemberships = await models.TripMember.exists({
    $or: [
      { trip: { $in: tripIds }, user: { $nin: ids } },
      { user: { $in: ids }, trip: { $nin: tripIds } },
    ],
  });
  if (realMemberships)
    throw new Error(
      "Sample accounts are linked to real members or trips. No sample data was deleted; review those memberships first.",
    );
  const files = await models.Document.find({ trip: { $in: tripIds } });
  await mongoose.connection.transaction(async (session) => {
    for (const Model of Object.values(mongoose.models)) {
      if (Model.schema.path("trip"))
        await Model.deleteMany({ trip: { $in: tripIds } }, { session });
    }
    await models.Notification.deleteMany({ user: { $in: ids } }, { session });
    await models.Trip.deleteMany({ _id: { $in: tripIds } }, { session });
    await models.User.deleteMany({ _id: { $in: ids } }, { session });
  });
  for (const file of files) await deleteStoredFile(file.filename);
  const email = (process.env.ADMIN_EMAIL || "admin@tripvero.app")
    .trim()
    .toLowerCase();
  let admin = await models.User.findOne({ email });
  if (admin && admin.role !== "admin")
    throw new Error(
      "That email belongs to a regular user. Choose a separate admin email.",
    );
  if (!admin) {
    const password =
      process.env.ADMIN_PASSWORD ||
      crypto.randomBytes(18).toString("base64url") + "!A1";
    if (password.length < 12)
      throw new Error("Admin password must be at least 12 characters");
    admin = await models.User.create({
      name: "Tripvero Administrator",
      email,
      role: "admin",
      password: await bcrypt.hash(password, 12),
    });
    await writeFile(
      new URL("../ADMIN-CREDENTIALS.txt", import.meta.url),
      `Tripvero administrator\nEmail: ${email}\nPassword: ${password}\nSign in through the normal login page, then open /app/admin.\nKeep this file private.\n`,
      { mode: 0o600 },
    );
    console.log(
      "Administrator created. Credentials saved privately in ADMIN-CREDENTIALS.txt.",
    );
  } else console.log("Administrator already exists; password preserved.");
  console.log(
    `Removed ${demos.length} sample users and ${demoTrips.length} sample trips.`,
  );
} finally {
  await mongoose.disconnect();
}
