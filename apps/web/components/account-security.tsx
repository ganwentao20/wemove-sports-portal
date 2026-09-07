"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  secureApiFetch,
  sessionLogout,
  type SessionKind,
} from "../lib/secure-api";
type Device = {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};
const input = "mt-1 w-full rounded-lg border p-2";
const button = "rounded-lg border px-4 py-2 font-medium disabled:opacity-50";
export function AccountSecurity({
  kind = "customer",
  mfaEnabled = false,
}: {
  kind?: SessionKind;
  mfaEnabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(mfaEnabled);
  const [devices, setDevices] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState("");
  const load = useCallback(
    async () =>
      setDevices(await secureApiFetch<Device[]>(kind, "/account/sessions")),
    [kind],
  );
  useEffect(() => {
    if (kind !== "staff")
      void secureApiFetch<{ mfaEnabled: boolean }>(kind, "/account/profile")
        .then((p) => setEnabled(p.mfaEnabled))
        .catch(() => undefined);
  }, [kind]);
  useEffect(() => {
    void load().catch((e) => setError(String(e.message)));
  }, [load]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function signInAgain() {
    await sessionLogout(kind).catch(() => undefined);
    window.location.assign(
      kind === "staff"
        ? "/admin/login"
        : kind === "dealer"
          ? "/dealer/login"
          : "/customer/login",
    );
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await run(async () => {
      await secureApiFetch(kind, "/account/password", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(d)),
      });
      await signInAgain();
    });
  }
  async function setup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await run(async () => {
      const result = await secureApiFetch<{ secret: string }>(
        kind,
        "/account/mfa/setup",
        {
          method: "POST",
          body: JSON.stringify({ password: d.get("password") }),
        },
      );
      setSecret(result.secret);
    });
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await run(async () => {
      await secureApiFetch(
        kind,
        kind === "staff"
          ? "/admin/me/mfa/disable"
          : `/account/mfa/${enabled ? "disable" : "confirm"}`,
        { method: "POST", body: JSON.stringify({ code: d.get("code") }) },
      );
      await signInAgain();
    });
  }
  return (
    <section className="mt-6 space-y-5 rounded-2xl border p-5">
      <h2 className="text-xl font-semibold">Security and devices</h2>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form onSubmit={password} className="grid gap-3 sm:grid-cols-2">
        <label>
          Current password
          <input
            name="oldPassword"
            autoComplete="current-password"
            type="password"
            required
            className={input}
          />
        </label>
        <label>
          New password
          <input
            name="newPassword"
            autoComplete="new-password"
            type="password"
            minLength={8}
            maxLength={72}
            pattern="(?=.*[A-Za-z])(?=.*[0-9]).+"
            required
            className={input}
          />
        </label>
        <p className="text-sm sm:col-span-2">
          Use at least eight characters with letters and numbers. Changing your
          password signs out every device.
        </p>
        <button disabled={busy} className={button}>
          Change password
        </button>
      </form>
      <div className="border-t pt-4">
        <h3 className="font-semibold">Two-factor authentication</h3>
        <p className="my-2 text-sm">
          {kind === "staff"
            ? "Required for every staff login. Resetting signs you out and requires enrolling an authenticator at the next login."
            : enabled
              ? "Enabled. A code is required at every login."
              : "Add an authenticator to protect your customer and dealer access."}
        </p>
        {kind !== "staff" && !enabled && !secret && (
          <form onSubmit={setup} className="flex flex-wrap items-end gap-3">
            <label>
              Current password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={input}
              />
            </label>
            <button disabled={busy} className={button}>
              Set up authenticator
            </button>
          </form>
        )}
        {secret && (
          <p className="my-3 break-all rounded bg-neutral-100 p-3">
            Add this key to your authenticator:{" "}
            <code className="select-all">{secret}</code>
          </p>
        )}
        {(enabled || secret || kind === "staff") && (
          <form onSubmit={verify} className="flex flex-wrap items-end gap-3">
            <label>
              Authenticator code
              <input
                name="code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                className={input}
              />
            </label>
            <button disabled={busy} className={button}>
              {kind === "staff"
                ? "Reset authenticator"
                : enabled
                  ? "Disable authenticator"
                  : "Confirm authenticator"}
            </button>
          </form>
        )}
      </div>
      <div className="border-t pt-4">
        <h3 className="font-semibold">Active sessions</h3>
        <button
          disabled={busy}
          className={`${button} my-3`}
          onClick={() =>
            void run(async () => {
              await secureApiFetch(kind, "/account/sessions", {
                method: "DELETE",
              });
              await load();
              setMessage("Other sessions revoked.");
            })
          }
        >
          Sign out other devices
        </button>
        <ul className="divide-y">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap justify-between gap-3 py-3"
            >
              <div>
                <p>
                  {d.current ? "This device" : "Other device"} ·{" "}
                  {d.ip ?? "IP unavailable"}
                </p>
                <p className="max-w-lg break-words text-xs">
                  {d.userAgent ?? "Browser session"}
                </p>
                <p className="text-xs">
                  Last active {new Date(d.lastSeenAt).toLocaleString()} ·
                  Expires {new Date(d.expiresAt).toLocaleString()}
                </p>
              </div>
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void run(async () => {
                    await secureApiFetch(kind, `/account/sessions/${d.id}`, {
                      method: "DELETE",
                    });
                    if (d.current) await signInAgain();
                    else await load();
                  })
                }
              >
                Sign out
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
