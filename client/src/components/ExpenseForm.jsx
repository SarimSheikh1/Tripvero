import React, { useState } from "react";
import { Plus, Trash2, Upload, Receipt } from "lucide-react";
import { api, uid, iso, categories, notifyError, money } from "../services/api";
import { useAuth } from "../context/Auth";
import { Modal, Field, Select, Button, Toggle } from "./UI";
export default function ExpenseForm({
  trip,
  members,
  expense,
  onClose,
  onSaved,
}) {
  const { user } = useAuth(),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(0),
    [preview, setPreview] = useState(null),
    [form, setForm] = useState({
      title: expense?.title || "",
      description: expense?.description || "",
      amount: expense?.amount || "",
      category: expense?.category || "Food",
      date: iso(expense?.date),
      splitType: expense?.splitType || "equal",
      personal: expense?.personal || false,
      paidBy: expense?.paidBy?.map((p) => ({
        user: uid(p.user),
        amount: p.amount,
      })) || [{ user: uid(user), amount: "" }],
      splitDetails:
        expense?.splitDetails?.map((p) => ({
          user: uid(p.user),
          value: p.value ?? 1,
        })) || members.map((m) => ({ user: uid(m.user), value: 1 })),
      receipt: uid(expense?.receipt) || null,
      notes: expense?.notes || "",
    });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const amount = Number(form.amount) || 0;
  const setAmount = (value) =>
    setForm({
      ...form,
      amount: value,
      paidBy:
        form.paidBy.length === 1
          ? [{ ...form.paidBy[0], amount: value }]
          : form.paidBy,
    });
  const personal = (checked) =>
    setForm({
      ...form,
      personal: checked,
      paidBy: checked
        ? [{ user: uid(user), amount: form.amount }]
        : form.paidBy,
      splitDetails: checked
        ? [{ user: uid(user), value: 1 }]
        : members.map((m) => ({ user: uid(m.user), value: 1 })),
      splitType: "equal",
    });
  const upload = async (file) => {
    if (!file) return;
    setUploading(1);
    const body = new FormData();
    body.append("file", file);
    body.append("category", "Receipts");
    try {
      const r = await api.post(`/trips/${trip._id}/documents/upload`, body, {
        onUploadProgress: (p) =>
          setUploading(Math.round((p.progress || 0) * 100) || 1),
      });
      setForm((v) => ({ ...v, receipt: r.data._id }));
      setPreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      );
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(0);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        paidBy: form.paidBy.map((p) => ({ ...p, amount: Number(p.amount) })),
        splitDetails: form.splitDetails.map((p) => ({
          ...p,
          value: Number(p.value),
        })),
      };
      const r = await api[expense ? "patch" : "post"](
        `/trips/${trip._id}/expenses${expense ? `/${expense._id}` : ""}`,
        payload,
      );
      onSaved(r.data);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  const participantOptions = members.map((m) => ({
    value: uid(m.user),
    label: m.user.name,
  }));
  let previewShares = [];
  if (form.splitDetails.length) {
    const sum = form.splitDetails.reduce((s, d) => s + Number(d.value || 0), 0);
    previewShares = form.splitDetails.map((d) => ({
      user: d.user,
      amount:
        form.splitType === "equal"
          ? amount / form.splitDetails.length
          : form.splitType === "exact"
            ? Number(d.value)
            : form.splitType === "percentage"
              ? (amount * Number(d.value)) / 100
              : sum
                ? (amount * Number(d.value)) / sum
                : 0,
    }));
  }
  return (
    <Modal
      title={expense ? "Edit expense" : "Add an expense"}
      onClose={() => {
        if (preview) URL.revokeObjectURL(preview);
        onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="amount-input">
          <span>{trip.currency}</span>
          <input
            aria-label="Expense amount"
            type="number"
            min="0.01"
            max="10000000000"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <Field
          label="What was it for?"
          name="title"
          value={form.title}
          onChange={change}
          placeholder="Dinner, hotel, a little adventure…"
          required
        />
        <div className="form-grid">
          <Field label="Category">
            <input
              list="expense-categories"
              name="category"
              value={form.category}
              onChange={change}
              required
            />
            <datalist id="expense-categories">
              {categories.map((c) => (
                <option value={c} key={c} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Date"
            type="date"
            name="date"
            value={form.date}
            onChange={change}
            required
          />
        </div>
        <Toggle
          label="Personal expense — only my spending"
          checked={form.personal}
          onChange={(e) => personal(e.target.checked)}
        />
        <div className="form-section">
          <div className="between">
            <h3>Who paid?</h3>
            {!form.personal && (
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  setForm({
                    ...form,
                    paidBy: [
                      ...form.paidBy,
                      {
                        user:
                          participantOptions.find(
                            (m) => !form.paidBy.some((p) => p.user === m.value),
                          )?.value || "",
                        amount: "",
                      },
                    ],
                  })
                }
                disabled={form.paidBy.length >= members.length}
              >
                <Plus size={15} />
                Add payer
              </button>
            )}
          </div>
          {form.paidBy.map((payer, i) => (
            <div className="payer-row" key={i}>
              <select
                aria-label={`Payer ${i + 1}`}
                value={payer.user}
                disabled={form.personal}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paidBy: form.paidBy.map((p, n) =>
                      n === i ? { ...p, user: e.target.value } : p,
                    ),
                  })
                }
              >
                {participantOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Amount paid by payer ${i + 1}`}
                type="number"
                min="0"
                step="0.01"
                value={payer.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paidBy: form.paidBy.map((p, n) =>
                      n === i ? { ...p, amount: e.target.value } : p,
                    ),
                  })
                }
                required
              />
              {form.paidBy.length > 1 && (
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Remove payer"
                  onClick={() =>
                    setForm({
                      ...form,
                      paidBy: form.paidBy.filter((_, n) => n !== i),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          <small
            className={
              Math.abs(
                form.paidBy.reduce((s, p) => s + Number(p.amount || 0), 0) -
                  amount,
              ) > 0.001
                ? "amber"
                : "muted"
            }
          >
            Payments total:{" "}
            {money(
              form.paidBy.reduce((s, p) => s + Number(p.amount || 0), 0),
              trip.currency,
            )}
          </small>
        </div>
        {!form.personal && (
          <div className="form-section">
            <Select
              label="Split between"
              name="splitType"
              options={[
                { value: "equal", label: "Equally" },
                { value: "exact", label: "Exact amounts" },
                { value: "percentage", label: "By percentage" },
                { value: "shares", label: "By shares" },
              ]}
              value={form.splitType}
              onChange={change}
            />
            {members.map((m) => {
              const selected = form.splitDetails.find(
                (d) => d.user === uid(m.user),
              );
              return (
                <div className="split-row" key={m._id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          splitDetails: e.target.checked
                            ? [
                                ...form.splitDetails,
                                { user: uid(m.user), value: 1 },
                              ]
                            : form.splitDetails.filter(
                                (d) => d.user !== uid(m.user),
                              ),
                        })
                      }
                    />
                    {m.user.name}
                  </label>
                  {selected && form.splitType !== "equal" && (
                    <input
                      aria-label={`${m.user.name} ${form.splitType}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={selected.value}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          splitDetails: form.splitDetails.map((d) =>
                            d.user === uid(m.user)
                              ? { ...d, value: e.target.value }
                              : d,
                          ),
                        })
                      }
                    />
                  )}
                  <small>
                    {money(
                      previewShares.find((p) => p.user === uid(m.user))
                        ?.amount || 0,
                      trip.currency,
                    )}
                  </small>
                </div>
              );
            })}
            <small className="muted">
              Final shares are rounded fairly to the nearest cent.
            </small>
          </div>
        )}
        <Field label="Receipt (optional)">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => upload(e.target.files[0])}
          />
        </Field>
        {uploading > 0 && <progress value={uploading} max={100} />}
        <small className="muted">
          JPG, PNG, WEBP or PDF · up to 8 MB · visible only to trip members
        </small>
        {preview && (
          <img
            src={preview}
            className="receipt-preview"
            alt="Receipt preview"
          />
        )}
        {form.receipt && (
          <div className="between">
            <a
              href={`/api/trips/${trip._id}/documents/${form.receipt}/file`}
              target="_blank"
              rel="noreferrer"
            >
              View attached receipt
            </a>
            <button
              className="text-btn"
              type="button"
              onClick={() => setForm({ ...form, receipt: null })}
            >
              Remove attachment
            </button>
          </div>
        )}
        <Field label="Notes (optional)">
          <textarea name="notes" value={form.notes} onChange={change} />
        </Field>
        <div className="form-actions">
          <Button type="button" className="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} disabled={uploading > 0}>
            {expense ? "Save changes" : "Save expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
