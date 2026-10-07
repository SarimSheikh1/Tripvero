import { assert, cents, cash, id } from "../utils/errors.js";
export function splitExpense(amount, type, details) {
  const total = cents(amount);
  assert(total > 0, "Amount must be greater than zero");
  assert(details.length > 0, "Select participants");
  assert(
    new Set(details.map((d) => id(d.user))).size === details.length,
    "Participants must be unique",
  );
  if (type === "exact") {
    const result = details.map((d) => ({
      user: id(d.user),
      amount: cash(cents(d.value)),
    }));
    assert(
      result.reduce((s, d) => s + cents(d.amount), 0) === total,
      "Exact amounts must add up to the expense",
    );
    return result;
  }
  assert(
    ["equal", "percentage", "shares"].includes(type),
    "Invalid split method",
  );
  const weights = details.map((d) => (type === "equal" ? 1 : Number(d.value)));
  assert(
    weights.every((w) => Number.isFinite(w) && w >= 0),
    "Split values must be nonnegative",
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  assert(sum > 0, "At least one share is required");
  if (type === "percentage")
    assert(Math.abs(sum - 100) < 0.000001, "Percentages must add up to 100");
  const raw = weights.map((w) => (total * w) / sum),
    values = raw.map(Math.floor);
  let remainder = total - values.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, f: v - values[i] }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (let n = 0; n < remainder; n++) values[order[n].i]++;
  return details.map((d, i) => ({ user: id(d.user), amount: cash(values[i]) }));
}
export function ledger(members, expenses, settlements) {
  const rows = new Map(
    members.map((m) => [
      id(m.user),
      {
        user: m.user,
        role: m.role,
        paid: 0,
        share: 0,
        personal: 0,
        settledSent: 0,
        settledReceived: 0,
        balance: 0,
      },
    ]),
  );
  for (const e of expenses) {
    for (const p of e.paidBy) {
      const r = rows.get(id(p.user));
      if (r) r.paid += cents(p.amount);
    }
    for (const p of e.participants) {
      const r = rows.get(id(p.user));
      if (r) {
        if (e.personal) r.personal += cents(p.amount);
        else r.share += cents(p.amount);
      }
    }
  }
  for (const s of settlements) {
    if (s.status !== "completed") continue;
    const from = rows.get(id(s.from)),
      to = rows.get(id(s.to));
    if (from) from.settledSent += cents(s.amount);
    if (to) to.settledReceived += cents(s.amount);
  }
  return [...rows.values()].map((r) => {
    r.balance =
      r.paid - r.share - r.personal + r.settledSent - r.settledReceived;
    return Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        typeof v === "number" ? cash(v) : v,
      ]),
    );
  });
}
function greedy(rows) {
  const debtors = rows
    .filter((r) => cents(Math.abs(r.balance)) > 0 && r.balance < 0)
    .map((r) => ({ user: id(r.user), value: cents(-r.balance) }));
  const creditors = rows
    .filter((r) => r.balance > 0)
    .map((r) => ({ user: id(r.user), value: cents(r.balance) }));
  const result = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.value - a.value);
    creditors.sort((a, b) => b.value - a.value);
    const d = debtors[0],
      c = creditors[0],
      amount = Math.min(d.value, c.value);
    result.push({ from: d.user, to: c.user, amount: cash(amount) });
    d.value -= amount;
    c.value -= amount;
    if (!d.value) debtors.shift();
    if (!c.value) creditors.shift();
  }
  return result;
}
export function analytics(trip, members, expenses, settlements, planning = {}) {
  const rows = ledger(members, expenses, settlements),
    spent = cash(expenses.reduce((s, e) => s + cents(e.amount), 0)),
    remaining = trip.budget - spent;
  const categories = {},
    daily = {};
  for (const e of expenses) {
    categories[e.category] = (categories[e.category] || 0) + e.amount;
    const day = new Date(e.date).toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + e.amount;
  }
  const duration = Math.max(
      1,
      Math.round(
        (new Date(trip.endDate) - new Date(trip.startDate)) / 86400000,
      ) + 1,
    ),
    today = new Date(),
    elapsed = Math.max(
      1,
      Math.min(
        duration,
        Math.floor((today - new Date(trip.startDate)) / 86400000) + 1,
      ),
    ),
    daysLeft = Math.max(1, duration - elapsed + 1),
    forecast =
      today < new Date(trip.startDate) ? spent : (spent / elapsed) * duration;
  const budgets =
    trip.categoryBudgets instanceof Map
      ? Object.fromEntries(trip.categoryBudgets)
      : trip.categoryBudgets || {};
  const insights = Object.entries(budgets)
    .filter(
      ([category, budget]) =>
        budget > 0 && (categories[category] || 0) / budget >= 0.75,
    )
    .map(
      ([category, budget]) =>
        `${category}: ${Math.round(((categories[category] || 0) / budget) * 100)}% of planned budget used.`,
    );
  if (forecast > trip.budget && spent > 0)
    insights.push(
      `At the current pace, spending may exceed the budget by ${trip.currency} ${Math.round(forecast - trip.budget).toLocaleString()}.`,
    );
  const outstanding = rows.reduce((s, r) => s + Math.max(0, r.balance), 0),
    progress = planning.total ? planning.completed / planning.total : 0;
  const health = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        40 *
          (trip.budget
            ? Math.max(0, 1 - Math.max(0, spent / trip.budget - 0.7))
            : 1) +
          30 * (spent ? 1 - Math.min(1, outstanding / spent) : 1) +
          20 * progress +
          10 * (planning.accommodation ? 1 : 0),
      ),
    ),
  );
  return {
    rows,
    suggestions: simplify(rows),
    settlementOptimal:
      rows.filter((r) => Math.round(Math.abs(r.balance) * 100) > 0).length <=
      12,
    spent,
    remaining,
    categories,
    daily,
    duration,
    daysLeft,
    dailyBudget: Math.max(0, remaining) / daysLeft,
    forecast,
    outstanding,
    insights,
    health,
    planningProgress: Math.round(progress * 100),
    recap: {
      days: duration,
      travelers: members.length,
      expenses: expenses.length,
      averagePerPerson: spent / Math.max(1, members.length),
      averagePerDay: spent / duration,
    },
    statistics: {
      biggestSpender: [...rows].sort(
        (a, b) => b.share + b.personal - (a.share + a.personal),
      )[0],
      mostGenerous: [...rows].sort((a, b) => b.paid - a.paid)[0],
      mostAdded: members
        .map((m) => ({
          user: m.user,
          count: expenses.filter((e) => id(e.createdBy) === id(m.user)).length,
        }))
        .sort((a, b) => b.count - a.count)[0],
    },
  };
}

export function simplify(rows) {
  const active = rows.filter((r) => Math.round(Math.abs(r.balance) * 100) > 0);
  if (active.length > 12) return greedy(active);
  const full = (1 << active.length) - 1,
    sums = new Array(full + 1).fill(0),
    memo = new Map();
  for (let mask = 1; mask <= full; mask++) {
    const bit = mask & -mask,
      index = Math.log2(bit);
    sums[mask] = sums[mask ^ bit] + Math.round(active[index].balance * 100);
  }
  function partition(mask) {
    if (!mask) return [];
    if (memo.has(mask)) return memo.get(mask);
    const first = mask & -mask;
    let best = [mask];
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if (!(sub & first) || sums[sub] !== 0) continue;
      const rest = partition(mask ^ sub),
        groups = [sub, ...rest];
      if (groups.length > best.length) best = groups;
    }
    memo.set(mask, best);
    return best;
  }
  return partition(full).flatMap((mask) =>
    greedy(active.filter((r, i) => mask & (1 << i))),
  );
}
