"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { unifiedSessionLogin, type SessionKind } from "@/lib/secure-api";
import { loginDestination } from "@/lib/login-destination";
import { loginCopy } from "@/lib/login-copy";
import { useHydrated } from "@/lib/use-hydrated";

type Challenge = {
  sessionKind: "staff";
  mfaRequired: true;
  enrollmentRequired: boolean;
  challengeToken: string;
  secret?: string;
  otpauthUrl?: string;
};
type SignedIn = {
  sessionKind: SessionKind;
  user: {
    mfaRequired?: boolean;
    mfaEnabled?: boolean;
    dealerTermsRequired?: boolean;
  };
};

export function LoginForm({ locale }: { locale: string }) {
  const t = loginCopy(locale),
    hydrated = useHydrated(),
    router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [needsCode, setNeedsCode] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (challenge || needsCode) codeInput.current?.focus();
  }, [challenge, needsCode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const code = String(form.get("code") ?? "").trim();
      const result = await unifiedSessionLogin<Challenge | SignedIn>(
        challenge
          ? { challengeToken: challenge.challengeToken, code }
          : {
              email: String(form.get("email") ?? "").trim(),
              password: String(form.get("password") ?? ""),
              ...(code ? { code } : {}),
            },
      );
      if ("challengeToken" in result) setChallenge(result);
      else {
        router.replace(
          loginDestination(
            result,
            new URLSearchParams(window.location.search).get("next"),
          ),
        );
        router.refresh();
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.code === 40302 && !challenge) {
          setNeedsCode(true);
          setError(t.mfaIntro);
        } else if (cause.status === 401 && challenge) {
          setChallenge(null);
          setError(t.expired);
        } else if (cause.status === 401) setError(t.invalid);
        else if (cause.status === 429) setError(t.limited);
        else if ((challenge || needsCode) && cause.code === 40301)
          setError(t.codeError);
        else if (cause.status >= 500) setError(t.unavailable);
        else setError(cause.message);
      } else setError(t.unavailable);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-[var(--wm-primary)] focus:ring-2 focus:ring-[var(--wm-primary)]/20 disabled:opacity-60";
  return (
    <form method="POST" onSubmit={submit} className="mt-8">
      <fieldset
        disabled={!hydrated || busy}
        className="space-y-5"
        aria-busy={busy || !hydrated}
      >
        {!challenge ? (
          <>
            <label className="block text-sm font-medium">
              {t.email}
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              {t.password}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={input}
              />
            </label>
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm underline underline-offset-4"
              >
                {t.forgot}
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t.mfaTitle}</h2>
            <p className="text-sm leading-6 text-neutral-600">
              {challenge.enrollmentRequired ? t.setup : t.mfaIntro}
            </p>
            {challenge.secret && (
              <div className="rounded-lg bg-neutral-100 p-4">
                <p className="text-xs font-semibold">{t.setupKey}</p>
                <code className="mt-2 block select-all break-all text-sm">
                  {challenge.secret}
                </code>
                {challenge.otpauthUrl && (
                  <a
                    href={challenge.otpauthUrl}
                    className="mt-3 block text-sm underline"
                  >
                    {t.openAuthenticator}
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        {(challenge || needsCode) && (
          <label className="block text-sm font-medium">
            {t.code}
            <input
              ref={codeInput}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className={input}
            />
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-[var(--wm-dark)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--wm-primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wm-primary)] disabled:opacity-60"
        >
          {busy ? t.busy : challenge || needsCode ? t.verify : t.title}
        </button>
        {(challenge || needsCode) && (
          <button
            type="button"
            className="w-full text-sm underline underline-offset-4"
            onClick={() => {
              setChallenge(null);
              setNeedsCode(false);
              setError("");
            }}
          >
            {t.restart}
          </button>
        )}
      </fieldset>
      {!challenge && (
        <p className="mt-7 text-center text-sm text-neutral-600">
          {t.newHere}{" "}
          <Link
            href="/customer/register"
            className="font-medium text-neutral-950 underline underline-offset-4"
          >
            {t.register}
          </Link>
        </p>
      )}
    </form>
  );
}
