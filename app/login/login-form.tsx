"use client";

import { FormEvent, useState } from "react";

export function LoginForm({
  returnTo,
  initialError,
}: {
  returnTo: string;
  initialError?: string;
}) {
  const [message, setMessage] = useState(initialError ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        returnTo,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    setSubmitting(false);
    setMessage(
      response.ok
        ? payload.message ?? "Check your email."
        : payload.error ?? "The sign-in link could not be sent.",
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
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Email me a sign-in link"}
      </button>
      {message ? <p className="login-message" role="status">{message}</p> : null}
    </form>
  );
}
