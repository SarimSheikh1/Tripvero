import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config, validateConfig } from "./config/env.js";
import { app } from "./app.js";
import { initializeSockets } from "./sockets/index.js";
validateConfig();
await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 10000 });
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.client, credentials: true },
  allowRequest: (req, callback) =>
    callback(null, !req.headers.origin || req.headers.origin === config.client),
});
app.set("io", io);
initializeSockets(io);
server.listen(config.port, () =>
  console.log(
    `Tripvero API ready at http://localhost:${config.port}; MongoDB connected`,
  ),
);
async function shutdown() {
  io.close();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
