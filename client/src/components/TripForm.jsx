import { t } from "../services/language";
import React, { useState } from "react";
import { api, notifyError, currencies, iso, uid } from "../services/api";
import { Modal, Field, Select, Button } from "./UI";
export default function TripForm({ trip, onClose, onSaved }) {
  const [form, setForm] = useState({
      name: trip?.name || "",
      destination: trip?.destination || "",
      description: trip?.description || "",
      startDate: iso(trip?.startDate),
      endDate: iso(trip?.endDate),
      currency: trip?.currency || "PKR",
      budget: trip?.budget || "",
      type: trip?.type || "Friends",
      coverImage: trip?.coverImage || "",
    }),
    [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api[trip ? "patch" : "post"](
        trip ? `/trips/${trip._id}` : "/trips",
        { ...form, budget: Number(form.budget) },
      );
      onSaved(r.data);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={trip ? "Edit trip" : "New trip"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field
          label="Trip name"
          name="name"
          value={form.name}
          onChange={change}
          placeholder="Hunza Adventure"
          required
          maxLength={120}
        />
        <Field
          label="Destination"
          name="destination"
          value={form.destination}
          onChange={change}
          placeholder="Where are we going?"
          required
        />
        <div className="form-grid">
          <Field
            label="Start date"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={change}
            required
          />
          <Field
            label="End date"
            name="endDate"
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={change}
            required
          />
          <Select
            label="Currency"
            name="currency"
            options={currencies}
            value={form.currency}
            onChange={change}
          />
          <Field
            label="Estimated budget"
            name="budget"
            type="number"
            min="0"
            step="0.01"
            value={form.budget}
            onChange={change}
            required
          />
        </div>
        <details className="simple-disclosure">
          <summary>{t("Optional details")}</summary>
          <Select
            label="Trip type"
            name="type"
            options={[
              "Friends",
              "Family",
              "Couple",
              "Business",
              "Solo",
              "Road Trip",
              "Adventure",
              "Religious",
              "Other",
            ]}
            value={form.type}
            onChange={change}
          />
          <Field label="Description">
            <textarea
              name="description"
              value={form.description}
              onChange={change}
              rows={3}
            />
          </Field>
          <Field
            label="Cover image URL (optional)"
            type="url"
            name="coverImage"
            value={form.coverImage}
            onChange={change}
            placeholder="https://..."
          />
        </details>
        <div className="form-actions">
          <Button type="button" className="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button busy={busy}>{trip ? "Save changes" : "Create trip"}</Button>
        </div>
      </form>
    </Modal>
  );
}
