import { t } from "../services/language";
import React, { useEffect, useState } from "react";
import { api, money, uid, notifyError } from "../services/api";
import { Button, Field, Select } from "./UI";
import { useAuth } from "../context/Auth";
export default function TravelChoices({ trip, members, role }) {
  const { user } = useAuth();
  const [choices, setChoices] = useState([]),
    [kind, setKind] = useState("hotel"),
    [name, setName] = useState(""),
    [total, setTotal] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false);
  const [busFare, setBusFare] = useState(""),
    [distance, setDistance] = useState(""),
    [efficiency, setEfficiency] = useState(""),
    [fuelPrice, setFuelPrice] = useState(""),
    [carHire, setCarHire] = useState(""),
    [tolls, setTolls] = useState(""),
    [seats, setSeats] = useState(4);
  const base = `/trips/${trip._id}/choices`,
    count = members.length || 1,
    writable = role !== "viewer" && trip.status === "active";
  const load = () =>
    api
      .get(base)
      .then((r) => setChoices(r.data))
      .catch(notifyError);
  useEffect(() => {
    load();
  }, [trip._id]);
  const valid =
    [busFare, distance, efficiency, fuelPrice].every(
      (v) => v !== "" && Number(v) > 0,
    ) && Number(seats) > 0;
  const cars = Math.ceil(count / Number(seats)),
    bus = Number(busFare) * count,
    car =
      cars *
      ((Number(distance) / Number(efficiency)) * Number(fuelPrice) +
        Number(carHire) +
        Number(tolls));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(base, { kind, name, total: Number(total), notes });
      setName("");
      setTotal("");
      setNotes("");
      await load();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (id, vote = false) => {
    try {
      if (vote) await api.post(`${base}/${id}/vote`);
      else await api.delete(`${base}/${id}`);
      await load();
    } catch (e) {
      notifyError(e);
    }
  };
  const ranked = choices
    .filter((c) => c.kind === "hotel")
    .sort((a, b) => b.votes.length - a.votes.length || a.total - b.total);
  return (
    <>
      <section className="panel">
        <h2>{t("Which hotel should we choose?")}</h2>
        <p className="muted">
          Compare actual hotel quotes and let the group vote. Budget guesthouse:
          lower cost. Standard hotel: comfort and value. Resort: more
          facilities. Add hotel names below; rates and availability must be
          confirmed with the property.
        </p>
        {ranked.length > 0 && (
          <p>
            <b>Group favourite:</b> {ranked[0].name} · {ranked[0].votes.length}{" "}
            votes · {money(ranked[0].total, trip.currency)} total stay{" "}
            {ranked[0].total > trip.budget
              ? "· exceeds the entire trip budget"
              : ""}
          </p>
        )}
      </section>
      <section className="panel">
        <h2>{t("Bus or car?")}</h2>
        <p className="muted">
          Enter your quotes for the full return journey in {trip.currency}. Car
          costs are per vehicle. Estimates exclude accommodation, meals and
          activities.
        </p>
        <div className="form-grid">
          {[
            ["Return bus fare per person", busFare, setBusFare],
            ["Total return distance (km)", distance, setDistance],
            ["Car efficiency (km/litre)", efficiency, setEfficiency],
            ["Fuel price per litre", fuelPrice, setFuelPrice],
            ["Car hire per vehicle (whole trip)", carHire, setCarHire],
            ["Tolls / parking per vehicle", tolls, setTolls],
            ["Passenger seats per car", seats, setSeats],
          ].map(([label, value, set]) => (
            <Field
              key={label}
              label={label}
              type="number"
              min={label === "Passenger seats per car" ? 1 : 0}
              step="any"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          ))}
        </div>
        {valid ? (
          <>
            <p>
              For {count} travellers: bus <b>{money(bus, trip.currency)}</b> (
              {money(bus / count, trip.currency)} per person); {cars} car(s){" "}
              <b>{money(car, trip.currency)}</b> (
              {money(car / count, trip.currency)} per person).
            </p>
            <p>
              <b>Cost recommendation: {bus <= car ? "Bus" : "Car"}.</b>{" "}
              {bus <= car
                ? "Bus is cheaper with these quotes; confirm timetable and seats."
                : "Car is cheaper with these estimates and gives flexible stops; confirm driver availability and road conditions."}{" "}
              Both estimates depend on your inputs.{" "}
              {Math.min(bus, car) > trip.budget
                ? "Both exceed the whole trip budget."
                : "Reserve budget for hotel, meals and activities."}
            </p>
          </>
        ) : (
          <p className="muted">
            Fill bus fare, distance, efficiency, fuel price and passenger seats
            to compare.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>{t("Group shortlist")}</h2>
        <p className="muted">
          A vote is a preference. Adding an option does not make a booking or
          add an expense.
        </p>
        {writable && (
          <form onSubmit={save}>
            <div className="form-grid">
              <Select
                label="Option type"
                options={["hotel", "bus", "car"]}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              />
              <Field
                label="Hotel / provider / vehicle name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Field
                label={`Total group cost (${trip.currency})`}
                required
                type="number"
                min="0"
                max="10000000000"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
              <Field
                label="Details: rooms, nights, location, facilities or route"
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button busy={busy} type="submit">
              {t("Add option")}
            </Button>
          </form>
        )}
        {choices.length === 0 && (
          <p className="muted">
            No options yet. Add the hotels and transport quotes you are
            considering.
          </p>
        )}
        {choices.map((c) => (
          <article
            key={c._id}
            style={{ borderTop: "1px solid var(--border)", padding: "16px 0" }}
          >
            <h3>
              {c.name} <small>· {c.kind}</small>
            </h3>
            <p>
              {money(c.total, trip.currency)} total ·{" "}
              {money(c.total / count, trip.currency)} per person ·{" "}
              {c.votes.length} votes
            </p>
            <p>{c.notes}</p>
            {writable && (
              <>
                <Button
                  className="secondary"
                  onClick={() => mutate(c._id, true)}
                >
                  {t("Vote / undo vote")}
                </Button>
                {(["owner", "admin"].includes(role) ||
                  uid(c.createdBy) === uid(user)) && (
                  <Button className="secondary" onClick={() => mutate(c._id)}>
                    {t("Remove option")}
                  </Button>
                )}
              </>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
