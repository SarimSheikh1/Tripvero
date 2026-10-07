import { t } from "../services/language";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  MapPin,
  CalendarDays,
  Users,
  Wallet,
  Luggage,
  HandCoins,
  TrendingUp,
  Archive,
  Ticket,
} from "lucide-react";
import {
  api,
  notifyError,
  money,
  date,
  cover,
  currencies,
} from "../services/api";
import { useAuth } from "../context/Auth";
import { useSocket } from "../components/Shell";
import {
  Button,
  Stat,
  Progress,
  Empty,
  Loading,
  Field,
  Modal,
} from "../components/UI";
import TripForm from "../components/TripForm";
import toast from "react-hot-toast";
export default function Dashboard({ tripsOnly = false }) {
  const { user } = useAuth(),
    socket = useSocket(),
    navigate = useNavigate(),
    [trips, setTrips] = useState(null),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [join, setJoin] = useState(false),
    [code, setCode] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("active"),
    [currency, setCurrency] = useState(user.currency || "PKR"),
    [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get("/trips")
      .then((r) => {
        setTrips(r.data);
        setError("");
      })
      .catch((e) => setError(e.userMessage));
  useEffect(() => {
    load();
    socket?.on("trip:update", load);
    socket?.on("notification", load);
    return () => {
      socket?.off("trip:update", load);
      socket?.off("notification", load);
    };
  }, [socket]);
  if (error)
    return (
      <Empty
        title="We couldn’t load your trips."
        text={error}
        action={<Button onClick={load}>{t("Try again")}</Button>}
      />
    );
  if (!trips) return <Loading />;
  const matching = trips.filter((t) => t.currency === currency),
    active = trips.filter((t) => t.status === "active");
  const total = (key) => matching.reduce((s, t) => s + (t[key] || 0), 0),
    owe = matching.reduce((s, t) => s + Math.max(0, -(t.own?.balance || 0)), 0),
    receive = matching.reduce(
      (s, t) => s + Math.max(0, t.own?.balance || 0),
      0,
    ),
    paid = matching.reduce((s, t) => s + (t.own?.paid || 0), 0);
  const visible = trips.filter(
    (t) =>
      t.status === status &&
      `${t.name} ${t.destination}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading dashboard-welcome">
        <div>
          <span className="eyebrow">{t("Your next adventure")}</span>
          <h1>
            {tripsOnly
              ? t("My trips")
              : `${t("Hello")} ${user.name.split(" ")[0]}`}
          </h1>
          <p>{t("Create a trip, invite friends and track expenses.")}</p>
        </div>
        <div className="actions">
          <Button className="secondary" onClick={() => setJoin(true)}>
            {t("Join a trip")}
          </Button>
          <Button onClick={() => setCreate(true)}>
            <Plus size={18} />
            {t("New trip")}
          </Button>
        </div>
      </div>
      {!tripsOnly && trips.length === 0 && (
        <section className="getting-started" aria-label="Getting started">
          <div>
            <span className="step-number">1</span>
            <h3>{t("Plan your trip")}</h3>
            <p>{t("Choose a destination, dates and budget.")}</p>
          </div>
          <div>
            <span className="step-number">2</span>
            <h3>{t("Bring your friends")}</h3>
            <p>{t("Share an invite code with your group.")}</p>
          </div>
          <div>
            <span className="step-number">3</span>
            <h3>{t("Keep track together")}</h3>
            <p>{t("Add expenses, plans and photos in one place.")}</p>
          </div>
        </section>
      )}
      {!tripsOnly && (
        <>
          <div className="summary-label">
            <span>{t("Your travel overview")}</span>
            <select
              aria-label="Summary currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <small>{t("Amounts grouped by currency")}</small>
          </div>
          <div className="stats-grid four">
            <Stat
              label="Active trips"
              value={active.length}
              icon={Luggage}
              note="More adventures ahead"
            />
            <Stat
              label="Total expenses"
              value={money(total("spent"), currency)}
              icon={TrendingUp}
            />
            <Stat
              label="You owe"
              value={money(owe, currency)}
              icon={HandCoins}
              tone="amber"
            />
            <Stat
              label="You’ll receive"
              value={money(receive, currency)}
              icon={HandCoins}
              tone="green"
            />
          </div>
        </>
      )}
      <div className="section-bar">
        <h2>
          {t("Your trips")}
          <span className="count">{visible.length}</span>
        </h2>
        <div className="actions">
          <input
            className="search-input"
            aria-label="Search trips"
            placeholder="Search trips or places…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Trip status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">{t("Active trips")}</option>
            <option value="archived">{t("Archived trips")}</option>
          </select>
        </div>
      </div>
      {visible.length ? (
        <div className="trip-grid">
          {visible.map((t, i) => (
            <Link to={`/app/trips/${t._id}`} className="trip-card" key={t._id}>
              <div
                className={`trip-cover cover-${i % 3}`}
                style={
                  t.coverImage
                    ? {
                        backgroundImage: `url("${t.coverImage.replaceAll('"', "")} ")`,
                      }
                    : {}
                }
              >
                {!t.coverImage && <MapPin size={45} />}
                <span className="badge">{t.type}</span>
                <span className="trip-destination">
                  <MapPin size={14} />
                  {t.destination}
                </span>
              </div>
              <div className="trip-card-body">
                <h3>{t.name}</h3>
                <div className="trip-meta">
                  <span>
                    <CalendarDays size={14} />
                    {date(t.startDate)} — {date(t.endDate)}
                  </span>
                  <span>
                    <Users size={14} />
                    {t.memberCount} travelers
                  </span>
                </div>
                <div className="between">
                  <span>
                    Spent <b>{money(t.spent, t.currency)}</b>
                  </span>
                  <small>of {money(t.budget, t.currency)}</small>
                </div>
                <Progress value={t.budget ? (t.spent / t.budget) * 100 : 0} />
                <div className="between">
                  <small>
                    {Math.round(t.budget ? (t.spent / t.budget) * 100 : 0)}%
                    used
                  </small>
                  <b className={t.budget - t.spent < 0 ? "amber" : "green"}>
                    {money(t.budget - t.spent, t.currency)} left
                  </b>
                </div>
              </div>
            </Link>
          ))}
          <button className="new-trip-card" onClick={() => setCreate(true)}>
            <span>
              <Plus size={28} />
            </span>
            <h3>The next chapter?</h3>
            <p>Start planning your next adventure.</p>
          </button>
        </div>
      ) : (
        <Empty
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus size={17} />
              Create your first trip
            </Button>
          }
        />
      )}
      <section className="dashboard-note">
        <div>
          <span className="eyebrow">A SMALL TIP FOR A SMOOTHER TRIP</span>
          <h3>Record it now. Relax later.</h3>
          <p>
            Log expenses as you go, so the only thing you bring home is
            memories.
          </p>
        </div>
        <Wallet size={64} />
      </section>
      {create && (
        <TripForm
          onClose={() => setCreate(false)}
          onSaved={(t) => {
            toast.success("Trip created");
            navigate(`/app/trips/${t._id}`);
          }}
        />
      )}
      {join && (
        <Modal title="Join your group" onClose={() => setJoin(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await api.post("/trips/join", { code });
                navigate(`/app/trips/${r.data._id}`);
                setJoin(false);
              } catch (e) {
                notifyError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Invitation code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TRIP-…"
              required
            />
            <Button busy={busy}>Join trip</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
