"use client";
import { useHydrated } from "../../../lib/use-hydrated";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import { sessionLogin } from "../../../lib/secure-api";
type Challenge = {
  mfaRequired: true;
  enrollmentRequired: boolean;
  challengeToken: string;
  secret?: string;
  otpauthUrl?: string;
};
export function AdminLoginForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await sessionLogin<Challenge | { user: { id: string } }>(
        "staff",
        challenge
          ? {
              challengeToken: challenge.challengeToken,
              code: String(form.get("code")),
            }
          : {
              email: String(form.get("email")).trim(),
              password: String(form.get("password")),
            },
      );
      if ("mfaRequired" in result) setChallenge(result);
      else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-1 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm";
  return (
    <form method="POST" onSubmit={submit} className="mt-6 space-y-4">
      <fieldset
        disabled={!hydrated}
        className="space-y-4"
        aria-busy={!hydrated}
      >
        {!challenge ? (
          <>
            <label className="block">
              Staff email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className={input}
              />
            </label>
            <label className="block">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={input}
              />
            </label>
          </>
        ) : (
          <>
            <p>
              {challenge.enrollmentRequired
                ? "Set up an authenticator before entering the administration area. Add this key to your authenticator, then enter its six-digit code."
                : "Enter the current code from your authenticator."}
            </p>
            {challenge.secret && (
              <div className="rounded-xl bg-neutral-100 p-4">
                <p className="text-sm">Authenticator setup key</p>
                <code className="block break-all select-all mt-2">
                  {challenge.secret}
                </code>
                <a className="mt-2 block underline" href={challenge.otpauthUrl}>
                  Open authenticator
                </a>
              </div>
            )}
            <label className="block">
              Authenticator code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className={input}
              />
            </label>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setChallenge(null);
                setError("");
              }}
            >
              Start again
            </button>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-full bg-[var(--wm-primary)] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Verifying…" : challenge ? "Verify and sign in" : "Continue"}
        </button>
      </fieldset>
    </form>
  );
}
