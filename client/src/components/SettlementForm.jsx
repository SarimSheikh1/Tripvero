import React, { useState } from "react";
import { api, uid, iso, notifyError } from "../services/api";
import { Modal, Field, Select, Button } from "./UI";
import { useAuth } from "../context/Auth";
export default function SettlementForm({
  trip,
  members,
  suggestion,
  onClose,
  onSaved,
}) {
  const { user } = useAuth(),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({
      from: suggestion?.from || uid(user),
      to:
        suggestion?.to ||
        uid(members.find((m) => uid(m.user) !== uid(user))?.user),
      amount: suggestion?.amount || "",
      date: iso(),
      method: "Cash",
      reference: "",
      notes: "",
      proof: null,
    }),
    [uploading, setUploading] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const options = members.map((m) => ({
    value: uid(m.user),
    label: m.user.name,
  }));
  return (
    <Modal title="Record a settlement" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/trips/${trip._id}/settlements`, {
              ...form,
              amount: Number(form.amount),
            });
            onSaved();
            onClose();
          } catch (e) {
            notifyError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">
          Record a payment already made between travelers. Tripvero does not
          transfer money.
        </p>
        <div className="form-grid">
          <Select
            label="From"
            name="from"
            value={form.from}
            onChange={change}
            options={options}
          />
          <Select
            label="To"
            name="to"
            value={form.to}
            onChange={change}
            options={options}
          />
          <Field
            label={`Amount (${trip.currency})`}
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={change}
            required
          />
          <Field
            label="Payment date"
            type="date"
            name="date"
            value={form.date}
            onChange={change}
            required
          />
        </div>
        <Select
          label="Payment method"
          name="method"
          value={form.method}
          onChange={change}
          options={[
            "Cash",
            "Bank Transfer",
            "EasyPaisa",
            "JazzCash",
            "Card",
            "Other",
          ]}
        />
        <Field
          label="Reference"
          name="reference"
          value={form.reference}
          onChange={change}
        />
        <Field label="Payment screenshot (optional)">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              setUploading(true);
              const body = new FormData();
              body.append("file", file);
              body.append("category", "Settlement proof");
              try {
                const r = await api.post(
                  `/trips/${trip._id}/documents/upload`,
                  body,
                );
                setForm((f) => ({ ...f, proof: r.data._id }));
              } catch (e) {
                notifyError(e);
              } finally {
                setUploading(false);
              }
            }}
          />
        </Field>
        {form.proof && <small className="green">Proof attached</small>}
        <Field
          label="Notes"
          name="notes"
          value={form.notes}
          onChange={change}
        />
        <div className="form-actions">
          <Button type="button" className="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy || uploading}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}
