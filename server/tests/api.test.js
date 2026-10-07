import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Document } from "../models/index.js";
import { deleteStoredFile } from "../services/storage.js";
let repl, app, owner, member, viewer, outsider, trip, user, other, readOnly;
const call = (agent, method, url, body) => {
  let r = agent[method](url).set("X-Tripvero-Request", "1");
  return body === undefined ? r : r.send(body);
};
const register = async (name, email) => {
  const agent = request.agent(app);
  const r = await call(agent, "post", "/api/auth/register", {
    name,
    email,
    password: "AstrongPassword!27",
    confirmPassword: "AstrongPassword!27",
  });
  assert.equal(r.status, 201, r.text);
  return { agent, user: r.body };
};
before(
  async () => {
    process.env.JWT_SECRET = crypto.randomBytes(40).toString("hex");
    process.env.NODE_ENV = "test";
    repl = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(repl.getUri());
    app = (await import("../app.js")).app;
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    ({ agent: owner, user } = await register("Owner", "owner@example.test"));
    ({ agent: member, user: other } = await register(
      "Member",
      "member@example.test",
    ));
    ({ agent: viewer, user: readOnly } = await register(
      "Viewer",
      "viewer@example.test",
    ));
    ({ agent: outsider } = await register("Outsider", "outsider@example.test"));
  },
  { timeout: 180000 },
);
after(async () => {
  for (const doc of await Document.find({}))
    await deleteStoredFile(doc.filename);
  await mongoose.disconnect();
  await repl?.stop();
});
test("authentication register, logout, login, no password exposure", async () => {
  const r = await call(owner, "get", "/api/auth/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.password, undefined);
  assert.equal(r.body.tokenVersion, undefined);
  await call(owner, "post", "/api/auth/logout");
  assert.equal((await call(owner, "get", "/api/auth/me")).status, 401);
  assert.equal(
    (
      await call(owner, "post", "/api/auth/login", {
        email: user.email,
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call(owner, "post", "/api/auth/login", {
        email: user.email,
        password: "AstrongPassword!27",
        remember: true,
      })
    ).status,
    200,
  );
});
test("create, update, invite and join a trip; outsider and role protection", async () => {
  const body = {
    name: "Test trip",
    destination: "Hunza",
    startDate: "2026-10-10",
    endDate: "2026-10-17",
    currency: "PKR",
    budget: 10000,
    type: "Friends",
  };
  const r = await call(owner, "post", "/api/trips", body);
  assert.equal(r.status, 201, r.text);
  trip = r.body;
  assert.equal(
    (
      await call(owner, "patch", `/api/trips/${trip._id}`, {
        ...body,
        name: "Updated trip",
      })
    ).status,
    200,
  );
  trip.name = "Updated trip";
  const invitation = await call(owner, "post", `/api/trips/${trip._id}/invite`);
  assert.equal(invitation.status, 200);
  assert.ok(invitation.body.link.includes("code="));
  assert.equal(
    (await call(member, "post", "/api/trips/join", { code: trip.inviteCode }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(owner, "post", `/api/trips/${trip._id}/members`, {
        email: readOnly.email,
        role: "viewer",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call(
        member,
        "patch",
        `/api/trips/${trip._id}/members/${user._id}`,
        { role: "member" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(outsider, "get", `/api/trips/${trip._id}`)).status,
    404,
  );
});
let expense;
test("expense CRUD, split, ledger and viewer protection", async () => {
  const body = {
    title: "Dinner",
    amount: 100,
    category: "Food",
    date: "2026-10-10",
    paidBy: [{ user: user._id, amount: 100 }],
    splitType: "equal",
    splitDetails: [{ user: user._id }, { user: other._id }],
  };
  const r = await call(owner, "post", `/api/trips/${trip._id}/expenses`, body);
  assert.equal(r.status, 201, r.text);
  expense = r.body;
  assert.equal(
    (await call(viewer, "post", `/api/trips/${trip._id}/expenses`, body))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        member,
        "patch",
        `/api/trips/${trip._id}/expenses/${expense._id}`,
        body,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        owner,
        "patch",
        `/api/trips/${trip._id}/expenses/${expense._id}`,
        { ...body, amount: 120, paidBy: [{ user: user._id, amount: 120 }] },
      )
    ).status,
    200,
  );
  const detail = await call(owner, "get", `/api/trips/${trip._id}`);
  assert.equal(detail.status, 200, detail.text);
  assert.equal(detail.body.analytics.spent, 120);
  assert.equal(
    detail.body.analytics.rows.find((r) => r.user._id === other._id).balance,
    -60,
  );
  assert.equal(
    detail.body.analytics.rows.find((r) => r.user._id === user._id).balance,
    60,
  );
});
test("personal spending belongs only to its author and does not change shared debt", async () => {
  const body = {
    title: "Shoes",
    amount: 80,
    category: "Shopping",
    date: "2026-10-10",
    paidBy: [{ user: other._id, amount: 80 }],
    splitType: "equal",
    personal: true,
    splitDetails: [{ user: other._id }],
  };
  assert.equal(
    (await call(member, "post", `/api/trips/${trip._id}/expenses`, body))
      .status,
    201,
  );
  assert.equal(
    (await call(owner, "post", `/api/trips/${trip._id}/expenses`, body)).status,
    400,
  );
  const d = (await call(member, "get", `/api/trips/${trip._id}`)).body;
  assert.equal(
    d.analytics.rows.find((r) => r.user._id === other._id).balance,
    -60,
  );
  assert.equal(
    d.analytics.rows.find((r) => r.user._id === other._id).personal,
    80,
  );
});
test("settlement recording, overpayment rejection and balance recalculation", async () => {
  const body = {
    from: other._id,
    to: user._id,
    amount: 60,
    date: "2026-10-10",
    method: "Cash",
  };
  assert.equal(
    (
      await call(member, "post", `/api/trips/${trip._id}/settlements`, {
        ...body,
        amount: 61,
      })
    ).status,
    400,
  );
  const r = await call(
    member,
    "post",
    `/api/trips/${trip._id}/settlements`,
    body,
  );
  assert.equal(r.status, 201, r.text);
  assert.equal(
    (await call(owner, "get", `/api/trips/${trip._id}`)).body.analytics
      .outstanding,
    0,
  );
  assert.equal(
    (await call(member, "post", `/api/trips/${trip._id}/settlements`, body))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        owner,
        "delete",
        `/api/trips/${trip._id}/settlements/${r.body._id}`,
      )
    ).status,
    200,
  );
});
test("category budgets and totals; member cannot edit budgets", async () => {
  assert.equal(
    (
      await call(member, "patch", `/api/trips/${trip._id}/budget`, {
        categoryBudgets: { Food: 1000 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(owner, "patch", `/api/trips/${trip._id}/budget`, {
        categoryBudgets: { Food: 1000 },
      })
    ).status,
    200,
  );
  const d = (await call(owner, "get", `/api/trips/${trip._id}`)).body;
  assert.equal(d.analytics.categories.Food, 120);
  assert.equal(d.analytics.remaining, 9800);
});
test("receipt validation and private authenticated downloads", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXe0AAAAASUVORK5CYII=",
    "base64",
  );
  const bad = await owner
    .post(`/api/trips/${trip._id}/documents/upload`)
    .set("X-Tripvero-Request", "1")
    .attach("file", Buffer.from("not-a-png"), {
      filename: "bad.png",
      contentType: "image/png",
    });
  assert.equal(bad.status, 400);
  const r = await owner
    .post(`/api/trips/${trip._id}/documents/upload`)
    .set("X-Tripvero-Request", "1")
    .attach("file", png, { filename: "receipt.png", contentType: "image/png" });
  assert.equal(r.status, 201, r.text);
  assert.equal(
    (
      await call(
        owner,
        "get",
        `/api/trips/${trip._id}/documents/${r.body._id}/file`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        outsider,
        "get",
        `/api/trips/${trip._id}/documents/${r.body._id}/file`,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app).get(
        `/api/trips/${trip._id}/documents/${r.body._id}/file`,
      )
    ).status,
    401,
  );
});
test("accommodation cost creates an expense, planning CRUD and author-only comments", async () => {
  const r = await call(owner, "post", `/api/trips/${trip._id}/accommodations`, {
    title: "Hotel",
    city: "Hunza",
    checkIn: "2026-10-10",
    checkOut: "2026-10-12",
    rooms: 2,
    roomPrice: 100,
    guests: 2,
    createExpense: true,
    paidBy: user._id,
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.body.total, 400);
  assert.ok(r.body.expense);
  const itinerary = await call(
    member,
    "post",
    `/api/trips/${trip._id}/itinerary`,
    { title: "Hike", date: "2026-10-11", time: "09:00", assigned: [other._id] },
  );
  assert.equal(itinerary.status, 201, itinerary.text);
  const comment = await call(
    member,
    "post",
    `/api/trips/${trip._id}/comments`,
    { text: "Let’s go!", targetType: "itinerary", target: itinerary.body._id },
  );
  assert.equal(comment.status, 201, comment.text);
  assert.equal(
    (
      await call(
        owner,
        "patch",
        `/api/trips/${trip._id}/comments/${comment.body._id}`,
        {
          text: "Wrong author",
          targetType: "itinerary",
          target: itinerary.body._id,
        },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        member,
        "delete",
        `/api/trips/${trip._id}/comments/${comment.body._id}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(member, "post", `/api/trips/${trip._id}/itinerary/reorder`, {
        ids: [itinerary.body._id],
      })
    ).status,
    200,
  );
});
test("authenticated realtime room delivers updates and rejects outsider membership", async () => {
  const { createServer } = await import("node:http"),
    { Server } = await import("socket.io"),
    { io: connect } = await import("socket.io-client"),
    { initializeSockets } = await import("../sockets/index.js");
  const server = createServer(app),
    io = new Server(server);
  app.set("io", io);
  initializeSockets(io);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const login = await call(member, "post", "/api/auth/login", {
      email: other.email,
      password: "AstrongPassword!27",
    }),
    cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
  const socket = connect("http://127.0.0.1:" + server.address().port, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      setTimeout(
        () => reject(new Error("Socket connection timeout")),
        5000,
      ).unref();
    });
    const joined = await new Promise((resolve) =>
      socket.emit("trip:join", trip._id, resolve),
    );
    assert.equal(joined.ok, true);
    const rejected = await new Promise((resolve) =>
      socket.emit(
        "trip:join",
        new mongoose.Types.ObjectId().toString(),
        resolve,
      ),
    );
    assert.equal(rejected.error, "Access denied");
    const event = new Promise((resolve, reject) => {
      socket.once("trip:update", resolve);
      setTimeout(
        () => reject(new Error("Realtime update timeout")),
        5000,
      ).unref();
    });
    assert.equal(
      (
        await call(owner, "post", `/api/trips/${trip._id}/checklist`, {
          title: "Realtime check",
          category: "Electronics",
        })
      ).status,
      201,
    );
    assert.equal((await event).tripId, trip._id);
  } finally {
    socket.disconnect();
    app.set("io", undefined);
    await new Promise((resolve) => io.close(resolve));
  }
});

test("every planning list, activity feed, member route and search is readable", async () => {
  for (const section of [
    "accommodations",
    "transport",
    "food",
    "itinerary",
    "checklist",
    "documents",
    "gallery",
    "comments",
    "activity",
    "members",
  ]) {
    const result = await call(
      owner,
      "get",
      `/api/trips/${trip._id}/${section}`,
    );
    assert.equal(result.status, 200, section + ": " + result.text);
    assert.ok(Array.isArray(result.body));
  }
  assert.equal(
    (await call(owner, "get", `/api/trips/${trip._id}/search?q=Hike`)).status,
    200,
  );
});
test("CSRF and archived trip write protection", async () => {
  assert.equal((await owner.post("/api/trips").send({})).status, 403);
  assert.equal(
    (
      await call(owner, "patch", `/api/trips/${trip._id}/status`, {
        status: "archived",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(member, "post", `/api/trips/${trip._id}/checklist`, {
        title: "Pack",
        category: "Clothes",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(owner, "get", `/api/trips/${trip._id}`)).status,
    200,
  );
  assert.equal(
    (
      await call(owner, "patch", `/api/trips/${trip._id}/status`, {
        status: "active",
      })
    ).status,
    200,
  );
});
test("app admin metrics reject regular users and signup cannot grant admin", async () => {
  const { User } = await import("../models/index.js");
  assert.equal((await call(owner, "get", "/api/admin/summary")).status, 403);
  const fake = await call(request.agent(app), "post", "/api/auth/register", {
    name: "Fake",
    email: "fake@example.test",
    password: "AstrongPassword!27",
    confirmPassword: "AstrongPassword!27",
    role: "admin",
  });
  assert.equal(fake.body.role, "user");
  await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
  const r = await call(owner, "get", "/api/admin/summary");
  assert.equal(r.status, 200);
  assert.ok(r.body.registered >= 5);
  assert.ok(r.body.activeToday >= 1);
  assert.ok(r.body.totalLogins >= 1);
  assert.equal(r.body.recentUsers[0].password, undefined);
  await User.updateOne({ _id: user._id }, { $set: { role: "user" } });
});
test("trip hotel choices are isolated, validated, voted and protected", async () => {
  const base = `/api/trips/${trip._id}/choices`;
  assert.equal(
    (
      await call(viewer, "post", base, {
        kind: "hotel",
        name: "Hotel",
        total: 200,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(owner, "post", base, {
        kind: "hotel",
        name: "Hotel",
        total: -1,
      })
    ).status,
    400,
  );
  const r = await call(owner, "post", base, {
    kind: "hotel",
    name: "Mountain hotel quote",
    total: 20000,
  });
  assert.equal(r.status, 201);
  const id = r.body._id;
  assert.equal((await call(outsider, "get", base)).status, 404);
  assert.equal(
    (await call(member, "post", `${base}/${id}/vote`)).body.votes.length,
    1,
  );
  assert.equal(
    (await call(member, "post", `${base}/${id}/vote`)).body.votes.length,
    0,
  );
  assert.equal((await call(member, "delete", `${base}/${id}`)).status, 403);
  assert.equal((await call(owner, "delete", `${base}/${id}`)).status, 200);
});

test("language preference is authenticated, validated and persisted", async () => {
  assert.equal(
    (
      await call(request.agent(app), "patch", "/api/users/me/language", {
        language: "roman-ur",
      })
    ).status,
    401,
  );
  assert.equal(
    (await call(owner, "patch", "/api/users/me/language", { language: "bad" }))
      .status,
    400,
  );
  assert.equal(
    (
      await call(owner, "patch", "/api/users/me/language", {
        language: "roman-ur",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(owner, "get", "/api/auth/me")).body.language,
    "roman-ur",
  );
  await call(owner, "patch", "/api/users/me/language", { language: "en" });
});

test("delete expense, preserve financial members and confirmed trip deletion", async () => {
  assert.equal(
    (
      await call(
        owner,
        "delete",
        `/api/trips/${trip._id}/expenses/${expense._id}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(owner, "delete", `/api/trips/${trip._id}/members/${other._id}`))
      .status,
    400,
  );
  assert.equal(
    (
      await call(owner, "delete", `/api/trips/${trip._id}`, {
        confirm: "wrong",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(owner, "delete", `/api/trips/${trip._id}`, {
        confirm: trip.name,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(owner, "get", `/api/trips/${trip._id}`)).status,
    404,
  );
});
