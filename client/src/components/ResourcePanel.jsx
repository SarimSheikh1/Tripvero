import React, { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Check,
  Image,
  ChevronUp,
  ChevronDown,
  Download,
} from "lucide-react";
import { api, notifyError, uid, date, money, iso } from "../services/api";
import { useAuth } from "../context/Auth";
import {
  Button,
  Modal,
  Field,
  Select,
  Toggle,
  Empty,
  Loading,
  Confirm,
} from "./UI";
import Comments from "./Comments";
const specs = {
  accommodations: {
    title: "Accommodation",
    singular: "stay",
    fields: [
      ["title", "Hotel name"],
      ["city", "City"],
      ["checkIn", "Check-in", "date"],
      ["checkOut", "Check-out", "date"],
      ["rooms", "Rooms", "number"],
      ["roomPrice", "Price per room / night", "number"],
      ["guests", "Guests", "number"],
      ["bookingReference", "Booking reference"],
      ["contact", "Contact number"],
      ["address", "Address"],
      ["notes", "Notes"],
    ],
  },
  transport: {
    title: "Transport & fuel",
    singular: "transport record",
    fields: [
      ["title", "Title"],
      [
        "type",
        "Type",
        [
          "Car",
          "Bike",
          "Bus",
          "Train",
          "Flight",
          "Taxi",
          "Rental Vehicle",
          "Fuel",
          "Other",
        ],
      ],
      ["provider", "Provider"],
      ["startLocation", "From"],
      ["destination", "Destination"],
      ["date", "Date", "date"],
      ["price", "Total price", "number"],
      ["bookingNumber", "Booking number"],
      ["driver", "Driver"],
      ["vehicle", "Vehicle"],
      ["liters", "Fuel liters", "number"],
      ["odometer", "Odometer", "number"],
      ["location", "Location"],
      ["notes", "Notes"],
    ],
  },
  food: {
    title: "Food & meals",
    singular: "meal",
    fields: [
      ["title", "Meal title"],
      [
        "type",
        "Meal type",
        ["Breakfast", "Lunch", "Dinner", "Snacks", "Restaurant", "Groceries"],
      ],
      ["restaurant", "Restaurant"],
      ["date", "Date", "date"],
      ["price", "Cost", "number"],
      ["notes", "Notes"],
    ],
  },
  itinerary: {
    title: "Your itinerary",
    singular: "activity",
    fields: [
      ["title", "Activity"],
      ["date", "Day", "date"],
      ["time", "Time", "time"],
      ["location", "Location"],
      ["cost", "Estimated cost", "number"],
      ["notes", "Notes"],
    ],
  },
  checklist: {
    title: "Travel checklist",
    singular: "item",
    fields: [
      ["title", "Item"],
      [
        "category",
        "Category",
        [
          "Clothes",
          "Documents",
          "Medicine",
          "Electronics",
          "Food",
          "Camping Equipment",
          "Personal Items",
        ],
      ],
      ["notes", "Notes"],
    ],
  },
  documents: { title: "Trip documents", singular: "document" },
  gallery: { title: "Trip gallery", singular: "photo" },
  activity: { title: "Trip activity", singular: "activity" },
};
export default function ResourcePanel({
  section,
  trip,
  members,
  role,
  refreshKey,
  onChange,
}) {
  const { user } = useAuth(),
    spec = specs[section],
    [items, setItems] = useState(null),
    [error, setError] = useState(""),
    [form, setForm] = useState(null),
    [remove, setRemove] = useState(null),
    [detail, setDetail] = useState(null),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(0);
  const canWrite = role !== "viewer" && trip.status === "active",
    admin = ["owner", "admin"].includes(role),
    canAdd =
      canWrite && (!["accommodations", "transport"].includes(section) || admin);
  const load = () =>
    api
      .get(`/trips/${trip._id}/${section}`)
      .then((r) => {
        setItems(r.data);
        setError("");
      })
      .catch((e) => setError(e.userMessage));
  useEffect(() => {
    setItems(null);
    load();
  }, [section, trip._id, refreshKey]);
  const blank = () =>
    Object.fromEntries(
      (spec.fields || []).map(([key, label, type]) => [
        key,
        type === "date"
          ? iso(trip.startDate)
          : type === "time"
            ? "09:00"
            : Array.isArray(type)
              ? type[0]
              : type === "number"
                ? key === "rooms" || key === "guests"
                  ? 1
                  : 0
                : "",
      ]),
    );
  const openForm = (item) =>
    setForm({
      ...blank(),
      ...(item || {}),
      createExpense: false,
      paidBy: uid(user),
      assigned:
        section === "itinerary"
          ? item?.assigned || []
          : uid(item?.assigned) || "",
    });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      for (const [key, , type] of spec.fields)
        if (type === "number") payload[key] = Number(payload[key]);
      if (!payload.assigned) delete payload.assigned;
      if (payload._id && payload.assigned?.[0]?._id)
        payload.assigned = payload.assigned.map(uid);
      await api[form._id ? "patch" : "post"](
        `/trips/${trip._id}/${section}${form._id ? `/${form._id}` : ""}`,
        payload,
      );
      setForm(null);
      load();
      onChange();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;
    setUploading(1);
    const body = new FormData();
    body.append("file", file);
    body.append("title", e.target.title.value);
    body.append(
      section === "gallery" ? "caption" : "category",
      e.target.meta.value,
    );
    try {
      await api.post(`/trips/${trip._id}/${section}/upload`, body, {
        onUploadProgress: (p) =>
          setUploading(Math.round((p.progress || 0) * 100) || 1),
      });
      setForm(null);
      load();
      onChange();
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(0);
    }
  };
  const toggle = async (item) => {
    try {
      await api.patch(`/trips/${trip._id}/${section}/${item._id}`, {
        ...item,
        assigned: Array.isArray(item.assigned)
          ? item.assigned.map(uid)
          : uid(item.assigned) || undefined,
        completed: !item.completed,
      });
      load();
      onChange();
    } catch (e) {
      notifyError(e);
    }
  };
  const move = async (item, offset) => {
    const order = [...items];
    const index = order.findIndex((i) => i._id === item._id),
      other = index + offset;
    if (other < 0 || other >= order.length) return;
    if (iso(order[index].date) !== iso(order[other].date)) return;
    [order[index], order[other]] = [order[other], order[index]];
    try {
      await api.post(`/trips/${trip._id}/itinerary/reorder`, {
        ids: order.map((i) => i._id),
      });
      load();
      onChange();
    } catch (e) {
      notifyError(e);
    }
  };
  if (error)
    return (
      <Empty
        title="Unable to load this section"
        text={error}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  if (!items) return <Loading />;
  const own = (item) => admin || uid(item.createdBy) === uid(user);
  return (
    <>
      <div className="section-bar">
        <div>
          <h2>{spec.title}</h2>
          <p className="muted">
            {section === "documents"
              ? "Private to your trip members. Avoid uploading sensitive IDs unless necessary."
              : section === "gallery"
                ? "The moments you’ll want to keep."
                : section === "itinerary"
                  ? "A little direction for every day."
                  : ""}
          </p>
        </div>
        {canAdd && section !== "activity" && (
          <Button onClick={() => openForm()}>
            <Plus size={17} />
            Add {spec.singular}
          </Button>
        )}
      </div>
      {!items.length ? (
        <Empty
          title={
            section === "gallery"
              ? "Make memories. Keep them here."
              : `No ${spec.singular}s yet.`
          }
          text="Add the first one to get your group started."
          action={
            canAdd && section !== "activity" ? (
              <Button onClick={() => openForm()}>Add {spec.singular}</Button>
            ) : null
          }
        />
      ) : section === "gallery" ? (
        <div className="gallery-grid">
          {items.map((item) => (
            <article key={item._id}>
              <button className="photo-button" onClick={() => setDetail(item)}>
                <img
                  src={`/api/trips/${trip._id}/documents/${uid(item.document)}/file`}
                  alt={item.caption || item.title}
                  loading="lazy"
                />
              </button>
              <div className="between">
                <div>
                  <b>{item.title}</b>
                  <small>
                    {date(item.date)} · {item.createdBy?.name}
                  </small>
                </div>
                {canWrite && uid(item.createdBy) === uid(user) && (
                  <button
                    aria-label="Delete photo"
                    className="icon-btn"
                    onClick={() => setRemove(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : section === "activity" ? (
        <div className="activity-list">
          {items.map((item) => (
            <article key={item._id}>
              <span className="activity-dot" />
              <div>
                <b>{item.text}</b>
                <small>
                  {item.user?.name} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </small>
                <button className="text-btn" onClick={() => setDetail(item)}>
                  Comments
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={`resource-grid ${["checklist", "itinerary"].includes(section) ? "list-layout" : ""}`}
        >
          {items.map((item, i) => (
            <article
              className={`resource-card ${item.completed ? "complete" : ""}`}
              key={item._id}
            >
              {["itinerary", "checklist"].includes(section) && (
                <button
                  className={`check-btn ${item.completed ? "checked" : ""}`}
                  aria-label={
                    item.completed ? "Mark incomplete" : "Mark complete"
                  }
                  disabled={!canWrite || !own(item)}
                  onClick={() => toggle(item)}
                >
                  {item.completed && <Check size={17} />}
                </button>
              )}
              <div className="resource-body">
                <span className="eyebrow">
                  {item.category ||
                    item.type ||
                    (section === "itinerary"
                      ? `${date(item.date)} · ${item.time}`
                      : section === "accommodations"
                        ? item.city
                        : "PRIVATE FILE")}
                </span>
                <h3>{item.title}</h3>
                {section === "accommodations" && (
                  <>
                    <p>
                      {date(item.checkIn)} — {date(item.checkOut)}
                    </p>
                    <p>
                      {item.rooms} rooms · {item.guests} guests ·{" "}
                      {Math.ceil(
                        (new Date(item.checkOut) - new Date(item.checkIn)) /
                          86400000,
                      )}{" "}
                      nights
                    </p>
                    <strong>{money(item.total, trip.currency)}</strong>
                  </>
                )}
                {["food", "transport"].includes(section) && (
                  <>
                    <p>
                      {item.provider || item.restaurant || item.vehicle}
                      {item.destination
                        ? ` · ${item.startLocation} → ${item.destination}`
                        : ""}
                    </p>
                    <p>{date(item.date)}</p>
                    <strong>{money(item.price, trip.currency)}</strong>
                    {item.type === "Fuel" && (
                      <p>
                        {item.liters || 0} liters · odometer{" "}
                        {item.odometer || "—"}
                      </p>
                    )}
                  </>
                )}
                {item.location && <p>{item.location}</p>}
                {item.notes && <p className="muted">{item.notes}</p>}
                {item.expense && (
                  <small className="green">
                    Expense created · changes to this record do not change the
                    expense
                  </small>
                )}
                {section === "documents" && (
                  <>
                    <small>
                      {item.originalName} · {(item.size / 1024).toFixed(0)} KB
                    </small>
                    <div className="actions">
                      <a
                        className="text-btn"
                        target="_blank"
                        rel="noreferrer"
                        href={`/api/trips/${trip._id}/documents/${item._id}/file`}
                      >
                        View
                      </a>
                      <a
                        className="text-btn"
                        href={`/api/trips/${trip._id}/documents/${item._id}/file?download=1`}
                      >
                        Download
                      </a>
                    </div>
                  </>
                )}
                {section === "itinerary" && (
                  <button className="text-btn" onClick={() => setDetail(item)}>
                    Details & comments
                  </button>
                )}
              </div>
              <div className="resource-actions">
                {section === "itinerary" && canWrite && (
                  <>
                    <button
                      className="icon-btn"
                      aria-label="Move activity up"
                      disabled={
                        i === 0 || iso(items[i - 1].date) !== iso(item.date)
                      }
                      onClick={() => move(item, -1)}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Move activity down"
                      disabled={
                        i === items.length - 1 ||
                        iso(items[i + 1].date) !== iso(item.date)
                      }
                      onClick={() => move(item, 1)}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </>
                )}
                {canWrite && own(item) && section !== "documents" && (
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${item.title}`}
                    onClick={() => openForm(item)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {canWrite && own(item) && (
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => setRemove(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {form && (
        <Modal
          title={`${form._id ? "Edit" : "Add"} ${spec.singular}`}
          onClose={() => setForm(null)}
        >
          {["documents", "gallery"].includes(section) ? (
            <form onSubmit={upload}>
              <Field label="Title" name="title" required />
              <Field
                label={section === "gallery" ? "Caption" : "Category"}
                name="meta"
              />
              <Field label="File">
                <input
                  name="file"
                  type="file"
                  accept={
                    section === "gallery"
                      ? ".jpg,.jpeg,.png,.webp"
                      : ".jpg,.jpeg,.png,.webp,.pdf"
                  }
                  required
                />
              </Field>
              <small className="muted">
                Up to 8 MB. Files are visible to every trip member.
              </small>
              {uploading > 0 && <progress max={100} value={uploading} />}
              <div className="form-actions">
                <Button busy={uploading > 0}>
                  <Upload size={16} />
                  Upload
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={save}>
              <div className="form-grid">
                {spec.fields.map(([key, label, type]) =>
                  Array.isArray(type) ? (
                    <Select
                      key={key}
                      label={label}
                      options={type}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  ) : (
                    <Field
                      key={key}
                      label={label}
                      type={type || "text"}
                      min={type === "number" ? "0" : undefined}
                      step={type === "number" ? "0.01" : undefined}
                      value={form[key] ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      required={[
                        "title",
                        "date",
                        "time",
                        "checkIn",
                        "checkOut",
                        "rooms",
                        "roomPrice",
                        "guests",
                        "price",
                      ].includes(key)}
                    />
                  ),
                )}
              </div>
              {["checklist", "itinerary"].includes(section) && (
                <Select
                  label="Assigned traveler"
                  options={[
                    { value: "", label: "Everyone / unassigned" },
                    ...members.map((m) => ({
                      value: uid(m.user),
                      label: m.user.name,
                    })),
                  ]}
                  value={
                    Array.isArray(form.assigned)
                      ? uid(form.assigned[0])
                      : uid(form.assigned)
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assigned:
                        section === "itinerary"
                          ? e.target.value
                            ? [e.target.value]
                            : []
                          : e.target.value,
                    })
                  }
                />
              )}{" "}
              {["accommodations", "food", "transport"].includes(section) &&
                !form.expense && (
                  <>
                    <Toggle
                      label="Also create a linked expense"
                      checked={form.createExpense}
                      onChange={(e) =>
                        setForm({ ...form, createExpense: e.target.checked })
                      }
                    />
                    {form.createExpense && (
                      <Select
                        label="Paid by"
                        options={members.map((m) => ({
                          value: uid(m.user),
                          label: m.user.name,
                        }))}
                        value={form.paidBy}
                        onChange={(e) =>
                          setForm({ ...form, paidBy: e.target.value })
                        }
                      />
                    )}
                  </>
                )}
              {section === "accommodations" && (
                <Field label="Booking screenshot (optional)">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploading(1);
                      const body = new FormData();
                      body.append("file", file);
                      body.append("category", "Hotel booking");
                      try {
                        const r = await api.post(
                          "/trips/" + trip._id + "/documents/upload",
                          body,
                        );
                        setForm((f) => ({ ...f, screenshot: r.data._id }));
                      } catch (e) {
                        notifyError(e);
                      } finally {
                        setUploading(0);
                      }
                    }}
                  />
                  {form.screenshot && (
                    <small className="green">Booking screenshot attached</small>
                  )}
                </Field>
              )}
              {section === "food" && (
                <Toggle
                  label="Personal meal"
                  checked={!!form.personal}
                  onChange={(e) =>
                    setForm({ ...form, personal: e.target.checked })
                  }
                />
              )}
              <div className="form-actions">
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => setForm(null)}
                >
                  Cancel
                </Button>
                <Button busy={busy} disabled={uploading > 0}>
                  Save {spec.singular}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {remove && (
        <Confirm
          message={`Delete “${remove.title}”? ${remove.expense ? "The linked expense stays in your ledger." : ""}`}
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            try {
              await api.delete(`/trips/${trip._id}/${section}/${remove._id}`);
              load();
              onChange();
            } catch (e) {
              notifyError(e);
            }
          }}
        />
      )}{" "}
      {detail && (
        <Modal
          title={detail.title || "Activity discussion"}
          onClose={() => setDetail(null)}
        >
          {section === "gallery" ? (
            <>
              <img
                className="lightbox-image"
                src={`/api/trips/${trip._id}/documents/${uid(detail.document)}/file`}
                alt={detail.caption || detail.title}
              />
              <p>{detail.caption}</p>
            </>
          ) : (
            <>
              <p>{detail.notes || detail.text}</p>
              <Comments
                tripId={trip._id}
                target={detail._id}
                targetType={section === "itinerary" ? "itinerary" : "activity"}
                canWrite={canWrite}
              />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
