import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url)),
  dbPath = path.join(root, "server", ".local-data");
await mkdir(dbPath, { recursive: true });
const mongo = await MongoMemoryServer.create({
  instance: {
    port: 27018,
    dbPath,
    storageEngine: "wiredTiger",
    replSet: "testset",
    ip: "127.0.0.1",
  },
  binary: { downloadDir: path.join(root, "server", ".mongo-binaries") },
});
const port = mongo.instanceInfo.port,
  host = `127.0.0.1:${port}`,
  client = new mongoose.mongo.MongoClient(
    `mongodb://${host}/?directConnection=true`,
  );
await client.connect();
const admin = client.db("admin");
for (let i = 0; i < 120; i++) {
  try {
    let current;
    try {
      current = (await admin.command({ replSetGetConfig: 1 })).config;
    } catch (error) {
      if (error.code !== 94) throw error;
    }
    if (current) {
      if (current.members[0].host !== host) {
        current.members = [{ _id: 0, host }];
        current.version++;
        await admin.command({ replSetReconfig: current, force: true });
      }
    } else
      await admin.command({
        replSetInitiate: { _id: "testset", members: [{ _id: 0, host }] },
      });
    if ((await admin.command({ hello: 1 })).isWritablePrimary) break;
  } catch (error) {
    if (
      !["MongoNetworkError", "MongoServerSelectionError"].includes(
        error.name,
      ) &&
      ![23, 94, 11600, 11602].includes(error.code)
    )
      throw error;
  }
  if (i === 119) throw new Error("MongoDB primary election timed out");
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await client.close();
let secret;
const secretPath = path.join(root, "server", ".local-secret");
try {
  secret = await readFile(secretPath, "utf8");
} catch {
  secret = crypto.randomBytes(48).toString("hex");
  await writeFile(secretPath, secret, { mode: 0o600 });
}
const env = {
  ...process.env,
  MONGODB_URI: `mongodb://${host}/tripvero?replicaSet=testset`,
  JWT_SECRET: secret,
  CLIENT_URL: "http://localhost:5173",
  PORT: "5000",
  NODE_ENV: "development",
};
await writeFile(
  path.join(root, "server", ".env.local"),
  Object.entries(env)
    .filter(([key]) =>
      ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL", "PORT", "NODE_ENV"].includes(
        key,
      ),
    )
    .map(([key, value]) => key + "=" + value)
    .join("\n") + "\n",
);
if (process.argv.includes("--seed")) {
  const seeded = spawn(process.execPath, ["seed.js"], {
    cwd: path.join(root, "server"),
    env,
    stdio: "inherit",
  });
  await new Promise((resolve, reject) =>
    seeded.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Seed failed")),
    ),
  );
}
const api = spawn(process.execPath, ["--watch", "server.js"], {
  cwd: path.join(root, "server"),
  env,
  stdio: "inherit",
});
const web = spawn(
  process.execPath,
  [
    path.join(root, "node_modules", "vite", "bin", "vite.js"),
    "--host",
    "localhost",
  ],
  { cwd: path.join(root, "client"), env, stdio: "inherit" },
);
console.log(
  "Tripvero local mode: real MongoDB with persistent files in server/.local-data.",
);
console.log(
  "Open http://localhost:5173. The database is preserved between runs.",
);
let exiting = false;
async function shutdown() {
  if (exiting) return;
  exiting = true;
  api.kill();
  web.kill();
  await mongo.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
api.on("exit", () => shutdown());
web.on("exit", () => shutdown());
