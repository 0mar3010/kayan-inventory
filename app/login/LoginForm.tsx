"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// autoplan T2 stopgap login — shared team password, not the final auth
// system. See CLAUDE.md section 9, Phase 0 (full Auth.js + roles).
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/review-queue";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // Tolerate an empty/non-JSON body (e.g. an unhandled 500) so the user
      // sees the status instead of a raw "Unexpected end of JSON input".
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Login failed (HTTP ${res.status})`);
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Kayan Store — Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Internal tool. Use your work email and the shared team password.</p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
