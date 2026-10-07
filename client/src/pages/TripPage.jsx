import { registerTripTools } from "../services/webmcp";
import React, { useEffect, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  Plus,
  MapPin,
  CalendarDays,
  Users,
  Wallet,
  TrendingUp,
  HandCoins,
  Pencil,
  Trash2,
  Copy,
  Download,
  Search,
  Printer,
  ArrowLeft,
  Receipt,
  ShieldCheck,
  Check,
  Archive,
  Settings,
  Route,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  api,
  uid,
  date,
  money,
  categories,
  notifyError,
  csvDownload,
} from "../services/api";
import { useAuth } from "../context/Auth";
import { useSocket } from "../components/Shell";
import {
  Button,
  Stat,
  Loading,
  Empty,
  Progress,
  Avatar,
  Modal,
  Confirm,
  Field,
  Select,
} from "../components/UI";
import ExpenseForm from "../components/ExpenseForm";
import SettlementForm from "../components/SettlementForm";
import TripForm from "../components/TripForm";
import ResourcePanel from "../components/ResourcePanel";
import Comments from "../components/Comments";
import Charts from "../components/Charts";
import TravelChoices from "../components/TravelChoices";
const mainTabs = new Set([
  "overview",
  "expenses",
  "choices",
  "itinerary",
  "gallery",
]);
const tabs = [
  ["overview", "Summary"],
  ["choices", "Hotels & travel"],
  ["members", "Members"],
  ["expenses", "Expenses"],
  ["budget", "Budget"],
  ["ledger", "Ledger"],
  ["settlements", "Settlements"],
  ["itinerary", "Plan"],
  ["accommodations", "Accommodation"],
  ["transport", "Transport"],
  ["food", "Food"],
  ["checklist", "Checklist"],
  ["documents", "Documents"],
  ["gallery", "Gallery"],
  ["activity", "Activity"],
  ["reports", "Reports"],
  ["settings", "Settings"],
];
export default function TripPage() {
  const { tripId } = useParams(),
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") || "overview",
    navigate = useNavigate(),
    { user } = useAuth(),
    socket = useSocket(),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [expenseModal, setExpenseModal] = useState(null),
    [settleModal, setSettleModal] = useState(null),
    [editingTrip, setEditingTrip] = useState(false),
    [confirm, setConfirm] = useState(null),
    [version, setVersion] = useState(0),
    [search, setSearch] = useState(""),
    [results, setResults] = useState(null),
    [invite, setInvite] = useState(null);
  const load = () =>
    api
      .get(`/trips/${tripId}`)
      .then((r) => {
        setData(r.data);
        setError("");
      })
      .catch((e) => setError(e.userMessage));
  const changed = () => {
    load();
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    setData(null);
    load();
  }, [tripId]);
  useEffect(() => {
    if (!socket) return;
    socket.emit("trip:join", tripId);
    const listener = (e) => {
      if (e.tripId === tripId) changed();
    };
    socket.on("trip:update", listener);
    return () => {
      socket.emit("trip:leave", tripId);
      socket.off("trip:update", listener);
    };
  }, [socket, tripId]);
  useEffect(() => {
    if (!socket || !data) return;
    socket.emit("trip:join", tripId);
  }, [data?.role]);
  useEffect(() => registerTripTools(data), [data]);
  if (error)
    return (
      <Empty
        title="This trip is unavailable"
        text={error}
        action={
          <Link className="btn" to="/app/trips">
            Back to trips
          </Link>
        }
      />
    );
  if (!data) return <Loading />;
  const { trip, members, role, analytics: a } = data,
    c = trip.currency,
    canWrite = role !== "viewer" && trip.status === "active",
    admin = ["owner", "admin"].includes(role),
    name = (id) =>
      members.find((m) => uid(m.user) === uid(id))?.user.name || "Traveler",
    showInvite = async () => {
      try {
        const r = await api.post(`/trips/${tripId}/invite`);
        setInvite(r.data);
      } catch (e) {
        notifyError(e);
      }
    };
  const confirmAction = (message, fn, title, required) =>
    setConfirm({ message, fn, title, required });
  const searchTrip = async (e) => {
    e.preventDefault();
    if (search.length < 2) return;
    try {
      setResults(
        (await api.get(`/trips/${tripId}/search`, { params: { q: search } }))
          .data,
      );
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <>
      <Link className="back-link" to="/app/trips">
        <ArrowLeft size={15} />
        All trips
      </Link>
      <div className="trip-heading">
        <div>
          <span className="eyebrow">
            {trip.type} ·{" "}
            {trip.status === "archived"
              ? "ARCHIVED ADVENTURE"
              : "YOUR SHARED ADVENTURE"}
          </span>
          <h1>{trip.name}</h1>
          <div className="trip-details">
            <span>
              <MapPin size={16} />
              {trip.destination}
            </span>
            <span>
              <CalendarDays size={16} />
              {date(trip.startDate)} — {date(trip.endDate)}
            </span>
            <span>
              <Users size={16} />
              {members.length} travelers
            </span>
          </div>
        </div>
        <div className="actions">
          {admin && canWrite && (
            <Button className="secondary" onClick={showInvite}>
              <Users size={17} />
              Invite group
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setExpenseModal({})}>
              <Plus size={18} />
              Add expense
            </Button>
          )}
        </div>
      </div>
      {trip.status === "archived" && (
        <div className="info-banner">
          This trip is archived. Its plans and financial history are read-only.
        </div>
      )}
      <div className="trip-tabs" role="navigation" aria-label="Trip sections">
        {tabs
          .filter(([key]) => mainTabs.has(key))
          .map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setParams({ tab: key })}
            >
              {label}
            </button>
          ))}
        <select
          aria-label="More trip tools"
          value={mainTabs.has(tab) ? "" : tab}
          onChange={(e) => {
            if (e.target.value) setParams({ tab: e.target.value });
          }}
        >
          <option value="">More tools</option>
          {tabs
            .filter(([key]) => !mainTabs.has(key))
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <details className="simple-disclosure">
        <summary>Search this trip</summary>
        <form className="trip-search" onSubmit={searchTrip}>
          <Search size={17} />
          <input
            aria-label="Search this trip"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses, travelers, places and notes…"
            minLength={2}
            maxLength={100}
          />
          <button className="text-btn">Search</button>
        </form>
      </details>
      {tab === "overview" && (
        <>
          <div className="trip-overview-banner">
            <div>
              <span className="eyebrow">THE ADVENTURE AT A GLANCE</span>
              <h2>
                {new Date(trip.startDate) > new Date()
                  ? `${Math.ceil((new Date(trip.startDate) - new Date()) / 86400000)} days until takeoff`
                  : "Make every day count."}
              </h2>
              <p>
                {trip.description ||
                  "Your plans, people and spending. All together."}
              </p>
            </div>
          </div>
          <div className="stats-grid four">
            <Stat
              label="Trip budget"
              value={money(trip.budget, c)}
              icon={Wallet}
            />
            <Stat
              label="Total spent"
              value={money(a.spent, c)}
              icon={TrendingUp}
              note={`${Math.round(trip.budget ? (a.spent / trip.budget) * 100 : 0)}% of budget`}
            />
            <Stat
              label="Remaining"
              value={money(a.remaining, c)}
              icon={Wallet}
              tone={a.remaining < 0 ? "amber" : "green"}
            />
            <Stat
              label="To settle"
              value={money(a.outstanding, c)}
              icon={HandCoins}
            />
          </div>
          <details className="simple-disclosure panel">
            <summary>Budget details & charts</summary>
            <div className="overview-insights">
              <article className="panel">
                <span className="eyebrow">PACE YOUR ADVENTURE</span>
                <h3>
                  {money(a.dailyBudget, c)} <small>/ day</small>
                </h3>
                <p>
                  Recommended spending across {a.daysLeft} remaining trip days.
                </p>
              </article>
              <article className="panel">
                <span className="eyebrow">YOUR PLANS ARE TAKING SHAPE</span>
                <h3>{a.planningProgress}% complete</h3>
                <Progress value={a.planningProgress} />
                <button
                  className="text-btn"
                  onClick={() => setParams({ tab: "itinerary" })}
                >
                  View your itinerary
                </button>
              </article>
            </div>
            <Charts analytics={a} members={members} currency={c} />
            {a.insights.length > 0 && (
              <section className="panel insights">
                <h3>Smart budget insights</h3>
                {a.insights.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </section>
            )}
          </details>
        </>
      )}
      {tab === "members" && (
        <MembersPanel
          data={data}
          user={user}
          onChange={changed}
          showInvite={showInvite}
          confirm={confirmAction}
        />
      )}
      {tab === "expenses" && (
        <ExpensesPanel
          trip={trip}
          members={members}
          role={role}
          version={version}
          onChange={changed}
          onEdit={setExpenseModal}
          confirm={confirmAction}
          user={user}
        />
      )}
      {tab === "budget" && <BudgetPanel data={data} onChange={changed} />}
      {tab === "ledger" && (
        <>
          <div className="section-bar">
            <div>
              <h2>Group ledger</h2>
              <p className="muted">
                Positive balances receive money. Negative balances owe money.
              </p>
            </div>
            <Button
              className="secondary"
              onClick={() =>
                csvDownload(
                  `${trip.name}-ledger.csv`,
                  a.rows.map((r) => ({ ...r, user: r.user.name })),
                )
              }
            >
              <Download size={16} />
              Export CSV
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Traveler</th>
                  <th>Paid</th>
                  <th>Shared responsibility</th>
                  <th>Personal</th>
                  <th>Sent / received</th>
                  <th>Net balance</th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={uid(r.user)}>
                    <td>
                      <span className="table-user">
                        <Avatar user={r.user} />
                        <b>{r.user.name}</b>
                      </span>
                    </td>
                    <td>{money(r.paid, c)}</td>
                    <td>{money(r.share, c)}</td>
                    <td>{money(r.personal, c)}</td>
                    <td>
                      {money(r.settledSent, c)} / {money(r.settledReceived, c)}
                    </td>
                    <td className={r.balance >= 0 ? "green" : "amber"}>
                      <b>
                        {r.balance > 0 ? "+" : ""}
                        {money(r.balance, c)}
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "settlements" && (
        <SettlementsPanel
          data={data}
          version={version}
          onChange={changed}
          onAdd={setSettleModal}
          confirm={confirmAction}
          user={user}
        />
      )}
      {[
        "itinerary",
        "accommodations",
        "transport",
        "food",
        "checklist",
        "documents",
        "gallery",
        "activity",
      ].includes(tab) && (
        <ResourcePanel
          section={tab}
          trip={trip}
          members={members}
          role={role}
          refreshKey={version}
          onChange={changed}
        />
      )}{" "}
      {tab === "reports" && <Reports data={data} />}{" "}
      {tab === "choices" && (
        <TravelChoices trip={trip} members={members} role={role} />
      )}
      {tab === "settings" && (
        <section className="panel settings-panel">
          <h2>Trip settings</h2>
          <p className="muted">
            {trip.name} · Your role: {role}
          </p>
          {admin && canWrite && (
            <Button className="secondary" onClick={() => setEditingTrip(true)}>
              <Pencil size={16} />
              Edit trip details
            </Button>
          )}
          {role === "owner" && (
            <>
              <h3>Trip lifecycle</h3>
              <p>Archive a completed trip to keep its history readable.</p>
              <Button
                className="secondary"
                onClick={() =>
                  confirmAction(
                    `${trip.status === "active" ? "Archive" : "Reopen"} this trip?`,
                    async () => {
                      await api.patch(`/trips/${tripId}/status`, {
                        status:
                          trip.status === "active" ? "archived" : "active",
                      });
                      changed();
                    },
                    "Change trip status",
                  )
                }
              >
                <Archive size={16} />
                {trip.status === "active" ? "Archive trip" : "Reopen trip"}
              </Button>
              {canWrite && (
                <Button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api.post(`/trips/${tripId}/invite/rotate`);
                      changed();
                      toast.success("Old invitation links are now invalid");
                    } catch (e) {
                      notifyError(e);
                    }
                  }}
                >
                  Reset invitation code
                </Button>
              )}
              <h3>Delete trip</h3>
              <p>Permanently deletes all trip records and uploaded files.</p>
              <Button
                className="danger"
                onClick={() =>
                  confirmAction(
                    "This permanently deletes the trip and its financial history.",
                    async () => {
                      await api.delete(`/trips/${tripId}`, {
                        data: { confirm: trip.name },
                      });
                      navigate("/app/trips");
                    },
                    "Delete trip",
                    trip.name,
                  )
                }
              >
                <Trash2 size={16} />
                Delete trip
              </Button>
            </>
          )}
          {role !== "owner" && canWrite && (
            <Button
              className="danger"
              onClick={() =>
                confirmAction(
                  "Leave this trip? Members with financial history must remain to preserve the ledger.",
                  async () => {
                    await api.delete(`/trips/${tripId}/members/${uid(user)}`);
                    navigate("/app/trips");
                  },
                  "Leave trip",
                )
              }
            >
              Leave trip
            </Button>
          )}
        </section>
      )}
      {expenseModal && (
        <ExpenseForm
          trip={trip}
          members={members}
          expense={expenseModal._id ? expenseModal : null}
          onClose={() => setExpenseModal(null)}
          onSaved={() => {
            changed();
            toast.success("Expense saved");
          }}
        />
      )}
      {settleModal && (
        <SettlementForm
          trip={trip}
          members={members}
          suggestion={settleModal.from ? settleModal : null}
          onClose={() => setSettleModal(null)}
          onSaved={() => {
            changed();
            toast.success("Payment recorded");
          }}
        />
      )}
      {editingTrip && (
        <TripForm
          trip={trip}
          onClose={() => setEditingTrip(false)}
          onSaved={changed}
        />
      )}{" "}
      {confirm && (
        <Confirm
          title={confirm.title}
          message={confirm.message}
          required={confirm.required}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await confirm.fn();
            } catch (e) {
              notifyError(e);
            }
          }}
        />
      )}{" "}
      {invite && (
        <Modal
          title="Travel is better together"
          onClose={() => setInvite(null)}
        >
          <p className="muted">
            Anyone with this code or link can join as a member. Share it with
            your group.
          </p>
          <Field label="Invitation code" value={invite.code} readOnly />
          <Field label="Invitation link" value={invite.link} readOnly />
          <Button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite.link);
                toast.success("Link copied");
              } catch {
                toast.error("Select and copy the link above");
              }
            }}
          >
            <Copy size={16} />
            Copy invitation
          </Button>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await api.post(`/trips/${tripId}/invite`, {
                  email: e.target.email.value,
                });
                toast[r.data.sent ? "success" : "error"](
                  r.data.sent
                    ? "Invitation sent"
                    : "Email delivery is not configured. Share the link instead.",
                );
              } catch (e) {
                notifyError(e);
              }
            }}
          >
            <Field
              label="Email invitation (optional)"
              name="email"
              type="email"
              required
            />
            <Button>Send invitation</Button>
          </form>
        </Modal>
      )}
      {results && (
        <Modal title="Search results" onClose={() => setResults(null)}>
          {results.length ? (
            results.map((r) => (
              <button
                className="search-result"
                key={r.id}
                onClick={() => {
                  setParams({ tab: r.section });
                  setResults(null);
                }}
              >
                <b>{r.title}</b>
                <span>{r.section}</span>
              </button>
            ))
          ) : (
            <Empty
              title="No matching records"
              text="Try a different word or traveler name."
            />
          )}
        </Modal>
      )}
      {canWrite && (
        <button
          className="mobile-expense-fab"
          onClick={() => setExpenseModal({})}
        >
          <Plus size={20} />
          Add expense
        </button>
      )}
    </>
  );
}
function MembersPanel({ data, user, onChange, showInvite, confirm }) {
  const { trip, members, role, analytics } = data,
    [email, setEmail] = useState(""),
    [memberRole, setMemberRole] = useState("member"),
    [busy, setBusy] = useState(false),
    admin = ["owner", "admin"].includes(role) && trip.status === "active";
  return (
    <>
      <div className="section-bar">
        <h2>Your travel crew</h2>
        {admin && (
          <Button onClick={showInvite}>
            <Plus size={16} />
            Invite travelers
          </Button>
        )}
      </div>
      {admin && (
        <form
          className="inline-form panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.post(`/trips/${trip._id}/members`, {
                email,
                role: memberRole,
              });
              setEmail("");
              onChange();
              toast.success("Member added");
            } catch (e) {
              notifyError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Add an existing user by email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            label="Role"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
            options={
              role === "owner"
                ? ["member", "admin", "viewer"]
                : ["member", "viewer"]
            }
          />
          <Button busy={busy}>Add member</Button>
        </form>
      )}
      <div className="member-grid">
        {members.map((m) => {
          const row = analytics.rows.find((r) => uid(r.user) === uid(m.user));
          return (
            <article className="panel member-card" key={m._id}>
              <div className="between">
                <Avatar user={m.user} size={48} />
                <span className="badge">{m.role}</span>
              </div>
              <h3>
                {m.user.name}
                {uid(m.user) === uid(user) ? " (you)" : ""}
              </h3>
              <p className="muted">{m.user.email}</p>
              <dl>
                <div>
                  <dt>Amount paid</dt>
                  <dd>{money(row.paid, trip.currency)}</dd>
                </div>
                <div>
                  <dt>Personal spending</dt>
                  <dd>{money(row.personal, trip.currency)}</dd>
                </div>
                <div>
                  <dt>Amount owed</dt>
                  <dd>{money(Math.max(0, -row.balance), trip.currency)}</dd>
                </div>
                <div>
                  <dt>Receivable</dt>
                  <dd className="green">
                    {money(Math.max(0, row.balance), trip.currency)}
                  </dd>
                </div>
              </dl>
              {admin && m.role !== "owner" && (
                <div className="member-actions">
                  {role === "owner" && (
                    <select
                      aria-label={`Role for ${m.user.name}`}
                      value={m.role}
                      onChange={async (e) => {
                        try {
                          await api.patch(
                            `/trips/${trip._id}/members/${uid(m.user)}`,
                            { role: e.target.value },
                          );
                          onChange();
                        } catch (e) {
                          notifyError(e);
                        }
                      }}
                    >
                      {["admin", "member", "viewer"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  <button
                    className="icon-btn"
                    aria-label="Remove member"
                    onClick={() =>
                      confirm(
                        `Remove ${m.user.name}? Financial history must be preserved.`,
                        async () => {
                          await api.delete(
                            `/trips/${trip._id}/members/${uid(m.user)}`,
                          );
                          onChange();
                        },
                        "Remove member",
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
function ExpensesPanel({
  trip,
  members,
  role,
  version,
  onChange,
  onEdit,
  confirm,
  user,
}) {
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null),
    [filters, setFilters] = useState({
      q: "",
      category: "",
      member: "",
      personal: "",
      start: "",
      end: "",
      min: "",
      max: "",
      page: 1,
    }),
    canWrite = role !== "viewer" && trip.status === "active";
  const load = () =>
    api
      .get(`/trips/${trip._id}/expenses`, {
        params: Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== ""),
        ),
      })
      .then((r) => {
        setResult(r.data);
        setError("");
      })
      .catch((e) => setError(e.userMessage));
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [JSON.stringify(filters), version]);
  const filter = (key, value) =>
    setFilters({ ...filters, [key]: value, page: key === "page" ? value : 1 });
  if (error)
    return (
      <Empty
        title="Expenses could not load"
        text={error}
        action={<Button onClick={load}>Retry</Button>}
      />
    );
  return (
    <>
      <div className="section-bar">
        <h2>Every expense, accounted for</h2>
        {canWrite && (
          <Button onClick={() => onEdit({})}>
            <Plus size={17} />
            Add expense
          </Button>
        )}
      </div>
      <div className="expense-filters">
        <input
          aria-label="Search expenses"
          placeholder="Find an expense…"
          value={filters.q}
          onChange={(e) => filter("q", e.target.value)}
        />
        <select
          aria-label="Category filter"
          value={filters.category}
          onChange={(e) => filter("category", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Member filter"
          value={filters.member}
          onChange={(e) => filter("member", e.target.value)}
        >
          <option value="">All travelers</option>
          {members.map((m) => (
            <option key={m._id} value={uid(m.user)}>
              {m.user.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sharing filter"
          value={filters.personal}
          onChange={(e) => filter("personal", e.target.value)}
        >
          <option value="">All expenses</option>
          <option value="false">Shared</option>
          <option value="true">Personal</option>
        </select>
        <Field
          label="From"
          type="date"
          value={filters.start}
          onChange={(e) => filter("start", e.target.value)}
        />
        <Field
          label="Until"
          type="date"
          value={filters.end}
          onChange={(e) => filter("end", e.target.value)}
        />
        <Field
          label="Minimum amount"
          type="number"
          min="0"
          value={filters.min}
          onChange={(e) => filter("min", e.target.value)}
        />
        <Field
          label="Maximum amount"
          type="number"
          min="0"
          value={filters.max}
          onChange={(e) => filter("max", e.target.value)}
        />
      </div>
      {!result ? (
        <Loading />
      ) : !result.items.length ? (
        <Empty
          title="No expenses here yet."
          text="Add an expense or adjust your filters."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Paid by</th>
                  <th>Split</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((e) => (
                  <tr key={e._id}>
                    <td>
                      <button
                        className="expense-title"
                        onClick={() => setDetail(e)}
                      >
                        <b>{e.title}</b>
                        <small>
                          {date(e.date)}
                          {e.receipt ? " · Receipt attached" : ""}
                        </small>
                      </button>
                    </td>
                    <td>
                      <span className="category-chip">{e.category}</span>
                    </td>
                    <td>
                      {e.paidBy
                        .map(
                          (p) =>
                            members.find((m) => uid(m.user) === uid(p.user))
                              ?.user.name,
                        )
                        .join(", ")}
                    </td>
                    <td>
                      {e.personal
                        ? "Personal"
                        : `${e.participants.length} travelers · ${e.splitType}`}
                    </td>
                    <td>
                      <b>{money(e.amount, trip.currency)}</b>
                    </td>
                    <td>
                      <div className="actions">
                        {canWrite &&
                          (["owner", "admin"].includes(role) ||
                            uid(e.createdBy) === uid(user)) && (
                            <>
                              <button
                                className="icon-btn"
                                aria-label={`Edit ${e.title}`}
                                onClick={() => onEdit(e)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-btn"
                                aria-label={`Delete ${e.title}`}
                                onClick={() =>
                                  confirm(
                                    `Delete “${e.title}”? Balances will be recalculated.`,
                                    async () => {
                                      await api.delete(
                                        `/trips/${trip._id}/expenses/${e._id}`,
                                      );
                                      onChange();
                                    },
                                    "Delete expense",
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <small>
              {result.total} expenses · page {result.page}
            </small>
            <Button
              className="secondary"
              disabled={filters.page === 1}
              onClick={() => filter("page", filters.page - 1)}
            >
              Previous
            </Button>
            <Button
              className="secondary"
              disabled={result.page * result.limit >= result.total}
              onClick={() => filter("page", filters.page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <h2>{money(detail.amount, trip.currency)}</h2>
          <p>{detail.description || detail.notes}</p>
          <h3>Who paid</h3>
          {detail.paidBy.map((p) => (
            <div className="between" key={uid(p.user)}>
              <span>
                {members.find((m) => uid(m.user) === uid(p.user))?.user.name}
              </span>
              <b>{money(p.amount, trip.currency)}</b>
            </div>
          ))}
          <h3>Everyone’s share</h3>
          {detail.participants.map((p) => (
            <div className="between" key={uid(p.user)}>
              <span>
                {members.find((m) => uid(m.user) === uid(p.user))?.user.name}
              </span>
              <b>{money(p.amount, trip.currency)}</b>
            </div>
          ))}
          {detail.receipt && (
            <a
              className="btn secondary"
              target="_blank"
              rel="noreferrer"
              href={`/api/trips/${trip._id}/documents/${uid(detail.receipt)}/file`}
            >
              View receipt
            </a>
          )}
          <Comments
            tripId={trip._id}
            target={detail._id}
            targetType="expense"
            canWrite={canWrite}
          />
        </Modal>
      )}
    </>
  );
}
function SettlementsPanel({ data, version, onChange, onAdd, confirm, user }) {
  const { trip, members, role, analytics: a } = data,
    [items, setItems] = useState([]);
  useEffect(() => {
    api
      .get(`/trips/${trip._id}/settlements`)
      .then((r) => setItems(r.data))
      .catch(notifyError);
  }, [version, trip._id]);
  const name = (v) =>
      members.find((m) => uid(m.user) === uid(v))?.user.name || "Traveler",
    canWrite = role !== "viewer" && trip.status === "active";
  return (
    <>
      <div className="section-bar">
        <div>
          <h2>Smart Settlement</h2>
          <p className="muted">
            A simpler path to even. Record payments after you make them.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => onAdd({})}>
            <Plus size={17} />
            Record payment
          </Button>
        )}
      </div>
      {!a.settlementOptimal && (
        <p className="muted">
          For groups with more than 12 unsettled travelers, this uses a fast
          simplification and may not give the fewest possible transfers.
        </p>
      )}
      <div className="settlement-grid">
        {a.suggestions.length ? (
          a.suggestions.map((s, i) => (
            <article className="panel" key={i}>
              <span className="eyebrow">SUGGESTED PAYMENT</span>
              <h3>
                {name(s.from)} <span className="muted">pays</span> {name(s.to)}
              </h3>
              <strong>{money(s.amount, trip.currency)}</strong>
              {canWrite &&
                (["owner", "admin"].includes(role) || s.from === uid(user)) && (
                  <Button className="secondary" onClick={() => onAdd(s)}>
                    <Check size={16} />
                    Record as paid
                  </Button>
                )}
            </article>
          ))
        ) : (
          <Empty
            title="All square. All smiles."
            text="There are no outstanding balances."
          />
        )}
      </div>
      <h2 className="subheading">Payment history</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s._id}>
                <td>{name(s.from)}</td>
                <td>{name(s.to)}</td>
                <td>
                  <b>{money(s.amount, trip.currency)}</b>
                </td>
                <td>
                  {s.method}
                  {s.reference && <small>{s.reference}</small>}
                </td>
                <td>{date(s.date)}</td>
                <td>
                  <div className="actions">
                    {s.proof && (
                      <a
                        href={`/api/trips/${trip._id}/documents/${uid(s.proof)}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Proof
                      </a>
                    )}
                    {canWrite &&
                      (["owner", "admin"].includes(role) ||
                        uid(s.createdBy) === uid(user)) && (
                        <button
                          className="icon-btn"
                          aria-label="Delete settlement"
                          onClick={() =>
                            confirm(
                              "Delete this payment record? Balances will change.",
                              async () => {
                                await api.delete(
                                  `/trips/${trip._id}/settlements/${s._id}`,
                                );
                                onChange();
                              },
                              "Delete settlement",
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="table-empty">No payments recorded yet.</p>
        )}
      </div>
    </>
  );
}
function BudgetPanel({ data, onChange }) {
  const { trip, role, analytics: a } = data,
    [budgets, setBudgets] = useState(trip.categoryBudgets || {}),
    [custom, setCustom] = useState(""),
    [busy, setBusy] = useState(false),
    admin = ["owner", "admin"].includes(role) && trip.status === "active";
  useEffect(() => {
    setBudgets(trip.categoryBudgets || {});
  }, [trip.categoryBudgets]);
  const keys = [
    ...new Set([
      ...categories,
      ...Object.keys(budgets),
      ...Object.keys(a.categories),
    ]),
  ];
  return (
    <>
      <div className="section-bar">
        <div>
          <h2>A budget for the good stuff</h2>
          <p className="muted">
            Plan the essentials. Leave a little room for adventure.
          </p>
        </div>
      </div>
      <div className="stats-grid four">
        <Stat
          label="Planned"
          value={money(trip.budget, trip.currency)}
          icon={Wallet}
        />
        <Stat
          label="Used"
          value={money(a.spent, trip.currency)}
          icon={TrendingUp}
        />
        <Stat
          label="Remaining"
          value={money(a.remaining, trip.currency)}
          icon={Wallet}
        />
        <Stat
          label="Daily recommendation"
          value={money(a.dailyBudget, trip.currency)}
          note={`${a.daysLeft} days left`}
        />
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch(`/trips/${trip._id}/budget`, {
              categoryBudgets: budgets,
            });
            onChange();
            toast.success("Budget saved");
          } catch (e) {
            notifyError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="budget-grid">
          {keys.map((category) => {
            const used = a.categories[category] || 0,
              planned = budgets[category] || 0,
              percent = planned ? (used / planned) * 100 : 0;
            return (
              <article className="panel" key={category}>
                <h3>{category}</h3>
                <Field
                  label={`Planned (${trip.currency})`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={planned}
                  disabled={!admin}
                  onChange={(e) =>
                    setBudgets({
                      ...budgets,
                      [category]: Number(e.target.value),
                    })
                  }
                />
                <div className="between">
                  <small>Used {money(used, trip.currency)}</small>
                  <b className={used > planned && planned ? "amber" : "green"}>
                    {money(planned - used, trip.currency)} left
                  </b>
                </div>
                <Progress value={percent} />
                {percent >= 80 && (
                  <small className="amber">
                    {percent >= 100
                      ? "Budget limit reached"
                      : "Approaching the limit"}{" "}
                    · {Math.round(percent)}%
                  </small>
                )}
              </article>
            );
          })}
        </div>
        {admin && (
          <div className="form-actions">
            <Field
              label="Custom category"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button
              type="button"
              className="secondary"
              disabled={!custom.trim()}
              onClick={() => {
                setBudgets({ ...budgets, [custom.trim()]: 0 });
                setCustom("");
              }}
            >
              Add category
            </Button>
            <Button busy={busy}>Save budgets</Button>
          </div>
        )}
      </form>
      <section className="panel forecast">
        <h3>Budget forecast</h3>
        <p>
          Current daily average:{" "}
          <b>
            {money(
              a.spent / Math.max(1, a.duration - a.daysLeft + 1),
              trip.currency,
            )}
          </b>
        </p>
        <p>
          Estimated final spending: <b>{money(a.forecast, trip.currency)}</b>
        </p>
        <p>
          Expected over budget:{" "}
          <b className="amber">
            {money(Math.max(0, a.forecast - trip.budget), trip.currency)}
          </b>
        </p>
        <small>
          Estimate based on elapsed trip days; early expenses can skew this
          forecast.
        </small>
      </section>
    </>
  );
}
export function Reports({ data }) {
  const { trip, members, analytics: a } = data;
  const exportData = async (section) => {
    try {
      let rows;
      if (section === "summary")
        rows = [
          {
            trip: trip.name,
            currency: trip.currency,
            budget: trip.budget,
            spent: a.spent,
            remaining: a.remaining,
            ...a.recap,
          },
        ];
      else if (section === "ledger")
        rows = a.rows.map((r) => ({ ...r, user: r.user.name }));
      else if (section === "members")
        rows = members.map((m) => ({
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        }));
      else if (section === "expenses") {
        rows = [];
        let page = 1;
        while (true) {
          const r = (
            await api.get(`/trips/${trip._id}/expenses`, {
              params: { limit: 100, page },
            })
          ).data;
          rows.push(...r.items);
          if (page * r.limit >= r.total) break;
          page++;
        }
        rows = rows.map((e) => ({
          title: e.title,
          date: e.date,
          category: e.category,
          currency: trip.currency,
          amount: e.amount,
          personal: e.personal,
          paidBy: e.paidBy,
          participants: e.participants,
        }));
      } else rows = (await api.get(`/trips/${trip._id}/settlements`)).data;
      csvDownload(`${trip.name}-${section}.csv`, rows);
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <>
      <div className="section-bar">
        <div>
          <h2>Trip reports & recap</h2>
          <p className="muted">The story of your trip, in numbers.</p>
        </div>
        <Button className="secondary" onClick={() => window.print()}>
          <Printer size={16} />
          Print / save as PDF
        </Button>
      </div>
      <section className="recap panel">
        <h2>{trip.name}</h2>
        <div className="recap-stats">
          {[
            [a.recap.days, "Days"],
            [a.recap.travelers, "Travelers"],
            [a.recap.expenses, "Expenses"],
            [money(a.spent, trip.currency), "Total spent"],
            [money(a.recap.averagePerPerson, trip.currency), "Per person"],
            [money(a.recap.averagePerDay, trip.currency), "Per day"],
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </section>
      <Charts analytics={a} members={members} currency={trip.currency} />
      <section className="panel fun-stats">
        <div>
          <span className="eyebrow">BIGGEST SPENDER</span>
          <h3>{a.statistics.biggestSpender?.user.name || "—"}</h3>
          <p>
            {money(
              (a.statistics.biggestSpender?.share || 0) +
                (a.statistics.biggestSpender?.personal || 0),
              trip.currency,
            )}
          </p>
        </div>
        <div>
          <span className="eyebrow">MOST GENEROUS</span>
          <h3>{a.statistics.mostGenerous?.user.name || "—"}</h3>
          <p>Paid {money(a.statistics.mostGenerous?.paid, trip.currency)}</p>
        </div>
        <div>
          <span className="eyebrow">MOST EXPENSES ADDED</span>
          <h3>{a.statistics.mostAdded?.user.name || "—"}</h3>
          <p>{a.statistics.mostAdded?.count || 0} expenses</p>
        </div>
      </section>
      <div className="actions report-exports">
        {["summary", "expenses", "members", "settlements", "ledger"].map(
          (section) => (
            <Button
              key={section}
              className="secondary"
              onClick={() => exportData(section)}
            >
              <Download size={16} />
              {section} CSV
            </Button>
          ),
        )}
      </div>
    </>
  );
}
