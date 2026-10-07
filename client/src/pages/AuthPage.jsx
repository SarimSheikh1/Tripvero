import React, { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, notifyError } from "../services/api";
import { useAuth } from "../context/Auth";
import { Logo, Field, Button, Toggle } from "../components/UI";
import { CheckCircle2, Plane } from "lucide-react";
import toast from "react-hot-toast";
export default function AuthPage({ mode = "login" }) {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      remember: false,
    });
  if (user && ["login", "register"].includes(mode))
    return <Navigate to="/app" />;
  const change = (e) =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const endpoint = {
        login: "login",
        register: "register",
        forgot: "forgot-password",
        reset: "reset-password",
      }[mode];
      const r = await api.post(
        `/auth/${endpoint}`,
        mode === "reset"
          ? { password: form.password, token: params.get("token") }
          : form,
      );
      if (["login", "register"].includes(mode)) {
        setUser(r.data);
        navigate(
          params.get("next")?.startsWith("/join") ? params.get("next") : "/app",
        );
      } else {
        toast.success(r.data.message);
        if (mode === "reset") navigate("/login");
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link to="/">
          <Logo />
        </Link>
        <div>
          <span className="eyebrow">LESS MATH. MORE MEMORIES.</span>
          <h1>
            Good company.
            <br />
            Great adventures.
            <br />
            <em>Clear balances.</em>
          </h1>
          <p>
            Keep your plans and your money in one place. All that’s left is
            enjoying the journey.
          </p>
          <div className="auth-benefits">
            {[
              "Plan your trip together",
              "Split every expense fairly",
              "Settle up without the awkwardness",
            ].map((t) => (
              <p key={t}>
                <CheckCircle2 size={20} />
                {t}
              </p>
            ))}
          </div>
        </div>
        <small>Plan Together. Spend Smarter. Travel Better.</small>
      </aside>
      <main className="auth-form">
        <Link className="mobile-logo" to="/">
          <Logo />
        </Link>
        <span className="small-icon">
          <Plane />
        </span>
        <h2>
          {mode === "register"
            ? "Your next adventure starts here"
            : mode === "forgot"
              ? "Forgot your password?"
              : mode === "reset"
                ? "Choose a new password"
                : "Welcome back, traveler"}
        </h2>
        <p className="muted">
          {mode === "register"
            ? "Create your free Tripvero account."
            : mode === "login"
              ? "Sign in to pick up where you left off."
              : "We’ll help you get back to your trips."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <Field
              label="Full name"
              name="name"
              value={form.name}
              onChange={change}
              autoComplete="name"
              required
            />
          )}
          {mode !== "reset" && (
            <Field
              label="Email address"
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              autoComplete="email"
              required
            />
          )}
          {mode === "register" && (
            <Field
              label="Phone number (optional)"
              name="phone"
              value={form.phone}
              onChange={change}
              autoComplete="tel"
            />
          )}
          {mode !== "forgot" && (
            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={change}
              minLength={mode === "login" ? 1 : 10}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          )}
          {mode === "register" && (
            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={change}
              required
            />
          )}
          {mode === "login" && (
            <div className="between">
              <Toggle
                label="Remember me"
                checked={form.remember}
                onChange={change.bind(null, {
                  target: {
                    name: "remember",
                    type: "checkbox",
                    checked: !form.remember,
                  },
                })}
              />
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          )}
          <Button busy={busy} className="full" type="submit">
            {mode === "register"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : mode === "reset"
                  ? "Update password"
                  : "Sign in"}
          </Button>
        </form>
        <p className="muted">
          {mode === "login" ? (
            <>
              New to Tripvero? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
        </p>
      </main>
    </div>
  );
}
