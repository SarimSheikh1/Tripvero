import test from "node:test";
import assert from "node:assert/strict";
import {
  splitExpense,
  ledger,
  simplify,
  analytics,
} from "../services/finance.js";
const members = ["a", "b", "c"].map((user) => ({ user, role: "member" }));
test("equal split preserves cents and deterministic remainder", () => {
  assert.deepEqual(splitExpense(10, "equal", members), [
    { user: "a", amount: 3.34 },
    { user: "b", amount: 3.33 },
    { user: "c", amount: 3.33 },
  ]);
});
test("percentage and weighted shares preserve total", () => {
  assert.deepEqual(
    splitExpense(100, "percentage", [
      { user: "a", value: 50 },
      { user: "b", value: 30 },
      { user: "c", value: 20 },
    ]).map((x) => x.amount),
    [50, 30, 20],
  );
  assert.deepEqual(
    splitExpense(100, "shares", [
      { user: "a", value: 2 },
      { user: "b", value: 1 },
      { user: "c", value: 1 },
    ]).map((x) => x.amount),
    [50, 25, 25],
  );
});
test("rejects invalid and duplicate splits", () => {
  assert.throws(() => splitExpense(10, "exact", [{ user: "a", value: 9 }]));
  assert.throws(() =>
    splitExpense(10, "percentage", [{ user: "a", value: 99 }]),
  );
  assert.throws(() =>
    splitExpense(10, "equal", [{ user: "a" }, { user: "a" }]),
  );
  assert.throws(() => splitExpense(0, "equal", members));
});
test("multiple payers, personal spending and settlements conserve zero balance", () => {
  const expenses = [
    {
      amount: 90,
      paidBy: [
        { user: "a", amount: 60 },
        { user: "b", amount: 30 },
      ],
      participants: splitExpense(90, "equal", members),
    },
    {
      amount: 20,
      personal: true,
      paidBy: [{ user: "c", amount: 20 }],
      participants: [{ user: "c", amount: 20 }],
    },
  ];
  const rows = ledger(members, expenses, []);
  assert.deepEqual(
    rows.map((r) => r.balance),
    [30, 0, -30],
  );
  assert.equal(rows[2].personal, 20);
  const suggestions = simplify(rows);
  assert.deepEqual(suggestions, [{ from: "c", to: "a", amount: 30 }]);
  const settled = ledger(
    members,
    expenses,
    suggestions.map((s) => ({ ...s, status: "completed" })),
  );
  assert.deepEqual(
    settled.map((r) => r.balance),
    [0, 0, 0],
  );
});
test("budget analytics computes category usage and recap", () => {
  const data = analytics(
    {
      budget: 100,
      currency: "USD",
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      categoryBudgets: { Food: 30 },
    },
    members,
    [
      {
        amount: 40,
        category: "Food",
        date: "2026-01-01",
        paidBy: [{ user: "a", amount: 40 }],
        participants: splitExpense(40, "equal", members),
      },
    ],
    [],
  );
  assert.equal(data.spent, 40);
  assert.equal(data.remaining, 60);
  assert.equal(data.duration, 7);
  assert.equal(data.categories.Food, 40);
  assert.ok(data.insights.some((i) => i.includes("Food")));
});

test("settlement optimizer finds minimum transfers where greedy overpays in steps", () => {
  const rows = [
    { user: "a", balance: -8 },
    { user: "b", balance: -7 },
    { user: "c", balance: -5 },
    { user: "d", balance: 10 },
    { user: "e", balance: 8 },
    { user: "f", balance: 2 },
  ];
  const plan = simplify(rows);
  assert.equal(plan.length, 4);
  const balances = new Map(rows.map((r) => [r.user, r.balance]));
  for (const payment of plan) {
    balances.set(payment.from, balances.get(payment.from) + payment.amount);
    balances.set(payment.to, balances.get(payment.to) - payment.amount);
  }
  assert.ok([...balances.values()].every((v) => v === 0));
});
