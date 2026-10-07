import { t } from "../services/language";
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { api, date, notifyError } from "../services/api";
import { Loading, Stat, Button } from "../components/UI";
export default function Admin() {
  const { user } = useAuth(),
    [data, setData] = useState(null);
  const load = () =>
    api
      .get("/admin/summary")
      .then((r) => setData(r.data))
      .catch(notifyError);
  useEffect(() => {
    if (user.role === "admin") load();
  }, [user.role]);
  if (user.role !== "admin") return <Navigate to="/app" replace />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("App administration")}</h1>
          <p className="muted">
            {t("See how many people are using Tripvero.")}
          </p>
        </div>
        <Button onClick={load}>{t("Refresh")}</Button>
      </div>
      <div className="stats-grid">
        {[
          ["Registered users", data.registered],
          ["Active · last 24 hours", data.activeToday],
          ["Active · last 7 days", data.activeWeek],
          ["New · last 7 days", data.newWeek],
          ["Users who logged in", data.loggedIn],
          ["Successful logins", data.totalLogins],
          ["Trips", data.trips],
          ["Expenses", data.expenses],
        ].map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
      <section className="panel">
        <h2>{t("Latest 100 registered users")}</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Email")}</th>
                <th>{t("Role")}</th>
                <th>{t("Joined")}</th>
                <th>{t("Last active")}</th>
                <th>{t("Logins")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUsers.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{date(u.createdAt)}</td>
                  <td>{date(u.lastActiveAt)}</td>
                  <td>{u.loginCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{data.measuredSince}</p>
      </section>
    </>
  );
}
