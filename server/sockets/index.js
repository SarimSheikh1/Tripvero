import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { User, TripMember } from "../models/index.js";
export function initializeSockets(io) {
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || "",
        token = cookie
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("tripvero="))
          ?.slice(9);
      const claims = jwt.verify(token, config.jwt, { algorithms: ["HS256"] });
      const user = await User.findById(claims.sub).select("+tokenVersion");
      if (!user || user.tokenVersion !== claims.ver)
        throw new Error("Unauthorized");
      socket.user = user;
      socket.expires = claims.exp * 1000;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, socket.expires - Date.now()),
    );
    socket.on("disconnect", () => clearTimeout(timer));
    socket.on("trip:join", async (tripId, ack) => {
      try {
        const membership = await TripMember.findOne({
          trip: tripId,
          user: socket.user._id,
        });
        if (!membership) return ack?.({ error: "Access denied" });
        socket.join(`trip:${tripId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ error: "Access denied" });
      }
    });
    socket.on("trip:leave", (tripId) => socket.leave(`trip:${tripId}`));
  });
}
