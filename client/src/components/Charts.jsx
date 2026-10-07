import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
const colors = [
  "#059669",
  "#38bdf8",
  "#f6ad55",
  "#7c83eb",
  "#e57692",
  "#457b9d",
];
export default function Charts({ analytics, members, currency }) {
  const category = Object.entries(analytics.categories).map(
      ([name, value]) => ({ name, value }),
    ),
    daily = Object.entries(analytics.daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date: date.slice(5), value })),
    paid = analytics.rows.map((r) => ({
      name: r.user.name,
      paid: r.paid,
      share: r.share + r.personal,
    }));
  return (
    <div className="charts-grid">
      <section className="panel">
        <h3>Where the budget goes</h3>
        <small>Spending by category · {currency}</small>
        {category.length ? (
          <>
            <div className="chart">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={category}
                    dataKey="value"
                    innerRadius={65}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {category.map((e, i) => (
                      <Cell key={e.name} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {category.map((c, i) => (
                <span key={c.name}>
                  <i style={{ background: colors[i % colors.length] }} />
                  {c.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="chart-empty">
            Add your first expense to see the breakdown.
          </p>
        )}
      </section>
      <section className="panel">
        <h3>Who’s paid what</h3>
        <small>Paid and responsibility · {currency}</small>
        <div className="chart">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={paid}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#94a3b833"
              />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis width={55} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="paid" fill="#059669" radius={[5, 5, 0, 0]} />
              <Bar dataKey="share" fill="#a7dcca" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <small>Emerald: paid · Mint: responsibility</small>
      </section>
      <section className="panel wide">
        <h3>Spending over time</h3>
        <small>Daily expenses · {currency}</small>
        {daily.length ? (
          <div className="chart">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={daily}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#94a3b833"
                />
                <XAxis dataKey="date" />
                <YAxis width={65} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#059669"
                  fill="#05966922"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="chart-empty">
            Your spending timeline will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
