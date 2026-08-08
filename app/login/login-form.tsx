"use client";

import { FormEvent, useState } from "react";

export function LoginForm({
  returnTo,
  initialError,
  configured,
}: {
  returnTo: string;
  initialError?: string;
  configured: boolean;
}) {
  const [message, setMessage] = useState(initialError ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          returnTo,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (response.ok) {
        window.location.assign(payload.redirectTo ?? returnTo);
        return;
      }
      setMessage(payload.error ?? "Sign-in failed.");
    } catch {
      setMessage("Could not reach the sign-in service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <div className="login-setup" role="status">
        <strong>Connect Supabase in Vercel</strong>
        <p>
          Add <code>HQ_SUPABASE_URL</code>,{" "}
          <code>HQ_SUPABASE_PUBLISHABLE_KEY</code>, and{" "}
          <code>HQ_OWNER_EMAIL</code> to the Production environment, then
          redeploy.
        </p>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="login-help">
        First time? Create the owner account once in Supabase Authentication →
        Users.
      </p>
      {message ? <p className="login-message" role="status">{message}</p> : null}
    </form>
  );
}
