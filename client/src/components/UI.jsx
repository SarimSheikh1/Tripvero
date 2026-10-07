import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Wallet,
  X,
  LoaderCircle,
  Compass,
  Trash2,
  Check,
} from "lucide-react";
export function Logo() {
  return (
    <span className="logo">
      <span className="logomark">
        <MapPin size={22} />
        <span />
      </span>
      tripvero<span className="logo-dot">.</span>
    </span>
  );
}
export function Button({ children, busy, className = "", ...props }) {
  return (
    <button
      className={`btn ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Select({ label, options, ...props }) {
  return (
    <Field label={label}>
      <select {...props}>
        {options.map((o) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(),
    previous = useRef();
  useEffect(() => {
    previous.current = document.activeElement;
    ref.current.showModal();
    return () => {
      previous.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-btn"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Confirm({
  title = "Confirm deletion",
  message,
  onConfirm,
  onClose,
  required,
}) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      {required && (
        <Field
          label={`Type ${required} to confirm`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      <div className="form-actions">
        <Button className="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="danger"
          busy={busy}
          disabled={required && text !== required}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={16} />
          Confirm
        </Button>
      </div>
    </Modal>
  );
}
export function Empty({
  title = "Your next adventure starts here.",
  text = "Create a trip and bring your group together.",
  action,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Compass size={36} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid">
      {[0, 1, 2, 3].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
export function Avatar({ user, size = 36 }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        (user?.name || "?")
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
export function Progress({ value }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Budget usage"
      aria-valuenow={Math.round(value || 0)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
        className={value >= 100 ? "over" : value >= 80 ? "warning" : ""}
      />
    </div>
  );
}
export function Stat({ label, value, icon: Icon, note, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        {Icon && <Icon size={19} />}
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-label">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
