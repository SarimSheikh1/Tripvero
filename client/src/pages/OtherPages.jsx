import React, { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { UserRound, Save, LogOut, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { api, notifyError, currencies, uid } from "../services/api";
import { useAuth } from "../context/Auth";
import {
  Button,
  Field,
  Select,
  Toggle,
  Avatar,
  Loading,
  Empty,
  Logo,
} from "../components/UI";
import { Reports } from "./TripPage";
export function Profile() {
  const { user, setUser } = useAuth(),
    [form, setForm] = useState({
      ...user,
      settings: {
        theme: user.settings?.theme || "light",
        notifications: user.settings?.notifications !== false,
      },
    }),
    [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>A little about you</h1>
          <p>Keep your traveler details and preferences up to date.</p>
        </div>
      </div>
      <form
        className="panel profile-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api.patch("/users/me", form);
            setUser(r.data);
            document.documentElement.dataset.theme = form.settings.theme;
            localStorage.setItem("tripvero-theme", form.settings.theme);
            toast.success("Profile updated");
          } catch (e) {
            notifyError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-avatar">
          <Avatar user={user} size={72} />
          <div>
            <h3>{user.name}</h3>
            <Field label="Profile photo">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const body = new FormData();
                  body.append("file", file);
                  try {
                    const r = await api.post("/users/me/avatar", body);
                    setUser(r.data);
                    setForm((f) => ({ ...f, avatar: r.data.avatar }));
                    toast.success("Photo updated");
                  } catch (e) {
                    notifyError(e);
                  }
                }}
              />
            </Field>
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Full name"
            name="name"
            value={form.name}
            onChange={change}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            required
          />
          <Field
            label="Phone"
            name="phone"
            value={form.phone || ""}
            onChange={change}
          />
          <Field
            label="Country"
            name="country"
            value={form.country || ""}
            onChange={change}
          />
          <Select
            label="Default currency"
            name="currency"
            options={currencies}
            value={form.currency}
            onChange={change}
          />
          <Select
            label="Preferred language"
            name="language"
            options={[
              { value: "en", label: "English" },
              { value: "ur", label: "Urdu" },
              { value: "ar", label: "Arabic" },
            ]}
            value={form.language || "en"}
            onChange={change}
          />
          <Select
            label="Theme"
            options={["light", "dark"]}
            value={form.settings.theme}
            onChange={(e) =>
              setForm({
                ...form,
                settings: { ...form.settings, theme: e.target.value },
              })
            }
          />
        </div>
        <small className="muted">
          Language is saved as a preference. The current interface is in
          English.
        </small>
        <Toggle
          label="Receive in-app trip notifications"
          checked={form.settings.notifications}
          onChange={(e) =>
            setForm({
              ...form,
              settings: { ...form.settings, notifications: e.target.checked },
            })
          }
        />
        <Button busy={busy}>
          <Save size={16} />
          Save profile
        </Button>
      </form>
    </>
  );
}
export function AllReports() {
  const [trips, setTrips] = useState(null),
    [selected, setSelected] = useState(""),
    [data, setData] = useState(null);
  useEffect(() => {
    api
      .get("/trips")
      .then((r) => {
        setTrips(r.data);
        setSelected(r.data[0]?._id || "");
      })
      .catch(notifyError);
  }, []);
  useEffect(() => {
    if (selected) {
      setData(null);
      api
        .get(`/trips/${selected}`)
        .then((r) => setData(r.data))
        .catch(notifyError);
    }
  }, [selected]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEE THE BIGGER PICTURE</span>
          <h1>Your travel reports</h1>
        </div>
      </div>
      {!trips ? (
        <Loading />
      ) : !trips.length ? (
        <Empty />
      ) : (
        <>
          <Select
            label="Choose a trip"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            options={trips.map((t) => ({ value: t._id, label: t.name }))}
          />
          {data ? <Reports data={data} /> : <Loading />}
        </>
      )}
    </>
  );
}
export function AllActivity() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api
      .get("/trips")
      .then(async (r) => {
        const feeds = await Promise.all(
          r.data.map(async (t) => {
            const activities = (await api.get(`/trips/${t._id}/activity`)).data;
            return activities.map((a) => ({
              ...a,
              tripName: t.name,
              tripId: t._id,
            }));
          }),
        );
        setItems(
          feeds
            .flat()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        );
      })
      .catch((e) => {
        notifyError(e);
        setItems([]);
      });
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">STAY IN THE LOOP</span>
          <h1>Recent activity</h1>
          <p>Everything happening across your adventures.</p>
        </div>
      </div>
      {!items ? (
        <Loading />
      ) : !items.length ? (
        <Empty
          title="A quiet start."
          text="Trip updates will appear here as your group gets going."
        />
      ) : (
        <div className="activity-list">
          {items.map((a) => (
            <article key={a._id}>
              <span className="activity-dot" />
              <div>
                <b>{a.text}</b>
                <small>
                  {new Date(a.createdAt).toLocaleString()} ·{" "}
                  <Link to={`/app/trips/${a.tripId}?tab=activity`}>
                    {a.tripName}
                  </Link>
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
export function Join() {
  const [params] = useSearchParams(),
    { user, loading } = useAuth(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(params.get("code") || "");
  return (
    <div className="join-page">
      <Link to="/">
        <Logo />
      </Link>
      <section className="panel">
        <h1>Your group is waiting.</h1>
        <p>Join their adventure on Tripvero.</p>
        {loading ? (
          <Loading />
        ) : !user ? (
          <>
            <p>Sign in or create an account to join.</p>
            <Link
              className="btn"
              to={`/login?next=${encodeURIComponent(`/join?code=${code}`)}`}
            >
              Sign in
            </Link>
            <Link
              className="btn secondary"
              to={`/register?next=${encodeURIComponent(`/join?code=${code}`)}`}
            >
              Create account
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await api.post("/trips/join", { code });
                navigate(`/app/trips/${r.data._id}`);
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
              required
            />
            <Button busy={busy}>Join trip</Button>
          </form>
        )}
      </section>
    </div>
  );
}
const content = {
  about: [
    "Built for shared adventures",
    "Tripvero brings group plans and shared spending together. Create a trip, invite your people, record expenses and settle with clarity.",
    "Contact: for a locally hosted installation, contact the person or team operating your Tripvero server. No public support email has been configured.",
  ],
  help: [
    "A smoother trip starts here",
    "1. Create an account and a trip. 2. Share the invitation code. 3. Add expenses with the correct payer and participants. 4. Use the ledger to check balances. 5. Make payments outside Tripvero and record them under Settlements.",
    "Owners and admins manage bookings, members and budgets. Members create their own records. Viewers can read. Archived trips are read-only. Keep a copy of important travel documents outside this app.",
  ],
  privacy: [
    "Your trip, your group",
    "Account details, trip plans, expenses and files are stored on the MongoDB database and upload storage configured by your operator. Files are accessible to authorized trip members; all members of your group can view uploaded documents. Upload sensitive IDs only when necessary.",
    "Authentication uses an HttpOnly session cookie. Theme preferences stay in your browser. Tripvero does not sell data or call paid AI services. Your operator manages retention, backups and requests for deletion. These notes describe this implementation and should be reviewed before a public launch.",
  ],
  terms: [
    "Travel together responsibly",
    "Tripvero helps organize trips and record expenses. It does not process payments, provide financial advice or guarantee the accuracy of information entered by your group. Confirm amounts and recipients before making payments.",
    "You are responsible for the records and files you upload. Only share invitations with intended travelers. Public deployment requires operator-specific terms and privacy review.",
  ],
};
export function InfoPage({ type }) {
  const [title, ...paragraphs] = content[type];
  return (
    <div className="info-page">
      <Link to="/">
        <Logo />
      </Link>
      <section className="panel">
        <h1>{title}</h1>
        {paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <Link className="btn secondary" to="/">
          Back to Tripvero
        </Link>
      </section>
    </div>
  );
}
