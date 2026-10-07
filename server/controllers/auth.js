import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { config } from "../config/env.js";
import {
  parse,
  registerSchema,
  loginSchema,
  profileSchema,
} from "../utils/validation.js";
import { assert } from "../utils/errors.js";
import { sendMail } from "../services/email.js";
const safe = (user) => {
  const value = user.toObject();
  for (const key of [
    "password",
    "tokenVersion",
    "resetHash",
    "resetExpires",
    "avatarFile",
    "avatarMime",
  ])
    delete value[key];
  return value;
};
function session(res, user, remember) {
  const duration = remember ? 30 * 86400 : 86400;
  const token = jwt.sign({ ver: user.tokenVersion || 0 }, config.jwt, {
    subject: String(user._id),
    expiresIn: duration,
    algorithm: "HS256",
  });
  res.cookie("tripvero", token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: duration * 1000 } : {}),
  });
}
export async function register(req, res) {
  const data = parse(registerSchema, req.body);
  const user = await User.create({
    ...data,
    password: await bcrypt.hash(data.password, 12),
  });
  session(res, user, false);
  res.status(201).json(safe(user));
}
export async function login(req, res) {
  const data = parse(loginSchema, req.body);
  const user = await User.findOne({ email: data.email }).select(
    "+password +tokenVersion",
  );
  assert(
    user && (await bcrypt.compare(data.password, user.password)),
    "Email or password is incorrect",
    401,
  );
  session(res, user, data.remember);
  user.lastLoginAt = new Date();
  user.lastActiveAt = new Date();
  user.loginCount = (user.loginCount || 0) + 1;
  await user.save();
  res.json(safe(user));
}
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  req.app.get("io")?.in(`user:${req.user._id}`).disconnectSockets(true);
  res.clearCookie("tripvero", {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Signed out" });
}
export async function me(req, res) {
  res.json(safe(req.user));
}
export async function profile(req, res) {
  const data = parse(profileSchema, req.body);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: data },
    { new: true, runValidators: true },
  );
  res.json(safe(user));
}
export async function forgot(req, res) {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const user = await User.findOne({ email });
  if (user && process.env.EMAIL_HOST) {
    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetHash: crypto.createHash("sha256").update(token).digest("hex"),
          resetExpires: new Date(Date.now() + 3600000),
        },
      },
    );
    await sendMail(
      user.email,
      "Reset your Tripvero password",
      `${config.client}/reset-password?token=${token}`,
    );
  }
  res.json({
    message:
      "If your account exists and email delivery is configured, a reset link has been sent.",
  });
}
export async function reset(req, res) {
  const password = String(req.body.password || ""),
    token = String(req.body.token || "");
  assert(
    password.length >= 10 && password.length <= 128,
    "Use a password of 10–128 characters",
  );
  assert(/^[a-f0-9]{64}$/.test(token), "Invalid reset link");
  const user = await User.findOne({
    resetHash: crypto.createHash("sha256").update(token).digest("hex"),
    resetExpires: { $gt: new Date() },
  }).select("+tokenVersion");
  assert(user, "Reset link is invalid or expired");
  const result = await User.updateOne(
    {
      _id: user._id,
      resetHash: crypto.createHash("sha256").update(token).digest("hex"),
    },
    {
      $set: { password: await bcrypt.hash(password, 12) },
      $inc: { tokenVersion: 1 },
      $unset: { resetHash: 1, resetExpires: 1 },
    },
  );
  assert(result.modifiedCount === 1, "Reset link already used");
  res.json({ message: "Password updated. Please sign in." });
}
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveFile, deleteStoredFile, uploadRoot } from "../services/storage.js";
import { TripMember } from "../models/index.js";
export async function avatar(req, res) {
  assert(
    req.file?.mimetype.startsWith("image/"),
    "Choose a JPG, PNG or WEBP photo",
  );
  const file = await saveFile(req.file);
  const previous = (await User.findById(req.user._id).select("+avatarFile"))
    ?.avatarFile;
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          avatar: `/api/users/${req.user._id}/avatar?v=${Date.now()}`,
          avatarFile: file.filename,
          avatarMime: file.mime,
        },
      },
      { new: true },
    );
    await deleteStoredFile(previous);
    res.json(safe(user));
  } catch (error) {
    await deleteStoredFile(file.filename);
    throw error;
  }
}
export async function avatarFile(req, res) {
  const target = await User.findById(req.params.userId).select(
    "+avatarFile +avatarMime",
  );
  assert(target?.avatarFile, "Photo not found", 404);
  if (String(target._id) !== String(req.user._id)) {
    const own = await TripMember.find({ user: req.user._id }).distinct("trip");
    assert(
      await TripMember.exists({ user: target._id, trip: { $in: own } }),
      "Photo not found",
      404,
    );
  }
  res.setHeader("Content-Type", target.avatarMime);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(path.join(uploadRoot, target.avatarFile));
}
