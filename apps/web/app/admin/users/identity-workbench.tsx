"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CustomerAccountReview } from "./customer-account-review";
import { secureApiFetch } from "../../../lib/secure-api";
type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  roles?: { code: string }[];
  permissionOverrides?: { grant?: string[]; deny?: string[] };
  mfaEnabled?: boolean;
};
type Role = {
  id: string;
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
  staffCount: number;
};
type Permission = { code: string; name: string };
type Privacy = {
  id: string;
  user: User;
  reason: string;
  status: string;
  resolution?: string;
};
type Audit = {
  id: string;
  actorKind: string;
  actor: { email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  before: unknown;
  after: unknown;
};
const input = "mt-1 w-full rounded-lg border p-2";
const button =
  "rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50";
export function IdentityWorkbench({
  mode,
}: {
  mode: "users" | "roles" | "audit";
}) {
  const [access, setAccess] = useState<{
    roles: string[];
    permissions: string[];
  }>({ roles: [], permissions: [] });
  const can = (code: string) =>
    access.roles.includes("SUPER_ADMIN") || access.permissions.includes(code);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffPage, setStaffPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [privacy, setPrivacy] = useState<Privacy[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const current = await secureApiFetch<{
      roles: string[];
      permissions: string[];
    }>("staff", "/auth/me");
    setAccess(current);
    if (
      mode === "users" &&
      (current.roles.includes("SUPER_ADMIN") ||
        current.permissions.includes("user:read"))
    ) {
      const result = await secureApiFetch<{ items: User[]; total: number }>(
        "staff",
        `/admin/users?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
      );
      setUsers(result.items);
      setTotal(result.total);
      setPrivacy(
        await secureApiFetch<Privacy[]>(
          "staff",
          "/admin/users/privacy-requests",
        ),
      );
    }
    if (mode === "roles") {
      const [r, p] = await Promise.all([
        secureApiFetch<Role[]>("staff", "/admin/roles"),
        secureApiFetch<{ items: Permission[] }[]>(
          "staff",
          "/admin/permissions",
        ),
      ]);
      setRoles(r);
      setPermissions(p.flatMap((g) => g.items));
    }
    if (mode === "audit") {
      const a = await secureApiFetch<{ items: Audit[]; total: number }>(
        "staff",
        `/admin/audit?page=${page}&pageSize=20&action=${encodeURIComponent(search)}`,
      );
      setAudit(a.items);
      setTotal(a.total);
    }
  }, [mode, page, search]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function run(work: () => Promise<void | string>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const message = await work();
      setNotice(message ?? "Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  function mutate(path: string, method: string, data: unknown) {
    return secureApiFetch("staff", path, {
      method,
      headers: { "x-mfa-code": code },
      body: JSON.stringify(data),
    });
  }
  async function loadStaff() {
    const [s, r, p] = await Promise.all([
      secureApiFetch<{ items: User[] }>(
        "staff",
        `/admin/staff?pageSize=50&page=${staffPage}&search=${encodeURIComponent(staffSearch)}`,
      ),
      can("system:rbac:write")
        ? secureApiFetch<Role[]>("staff", "/admin/roles")
        : Promise.resolve([]),
      can("system:rbac:write")
        ? secureApiFetch<{ items: Permission[] }[]>(
            "staff",
            "/admin/permissions",
          )
        : Promise.resolve([]),
    ]);
    setStaff(s.items);
    setRoles(r);
    setPermissions(p.flatMap((g) => g.items));
  }
  function fields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <nav className="flex flex-wrap gap-4 text-sm underline">
        <Link href="/admin/dashboard">Dashboard</Link>
        {(can("user:read") || can("system:staff:read")) && (
          <Link href="/admin/users">Users and staff</Link>
        )}
        {can("system:rbac:write") && <Link href="/admin/roles">Roles</Link>}
        {can("system:audit:read") && <Link href="/admin/audit">Audit log</Link>}
        <Link href="/admin/security">My security</Link>
      </nav>
      <h1 className="my-6 text-3xl font-bold">
        {mode === "users"
          ? "Users and staff"
          : mode === "roles"
            ? "Roles and permissions"
            : "Audit log"}
      </h1>
      {error && (
        <p role="alert" className="my-4 rounded bg-red-50 p-3 text-red-700">
          {error}{" "}
          <Link href="/admin/login" className="underline">
            Sign in
          </Link>
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 rounded bg-green-50 p-3">
          {notice}
        </p>
      )}
      {mode !== "audit" && (
        <label className="mb-6 block max-w-xs">
          Authenticator code for sensitive changes
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={input}
          />
        </label>
      )}
      {mode !== "roles" && (mode !== "users" || can("user:read")) && (
        <label className="mb-5 block max-w-md">
          {mode === "users" ? "Search customers" : "Filter audit action"}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={input}
          />
        </label>
      )}
      {mode === "users" && (
        <>
          {can("user:read") && (
            <>
              <section className="rounded-xl border p-4">
                <h2 className="text-xl font-semibold">Customer accounts</h2>
                <div className="mt-3 divide-y">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p>
                          {u.name} · {u.email}
                        </p>
                        <p className="text-sm">
                          {u.status} · MFA {u.mfaEnabled ? "enabled" : "off"}
                        </p>
                      </div>
                      <CustomerAccountReview
                        id={u.id}
                        canWrite={can("user:write")}
                        code={code}
                      />
                      <button
                        disabled={
                          busy || u.status === "PENDING" || !can("user:write")
                        }
                        className={button}
                        onClick={() =>
                          void run(async () => {
                            const reason = window.prompt(
                              "Reason for account access change (at least 5 characters)",
                            );
                            if (!reason || reason.trim().length < 5)
                              throw new Error(
                                "An access-change reason of at least 5 characters is required.",
                              );
                            await mutate(
                              `/admin/users/${u.id}/status`,
                              "PATCH",
                              {
                                reason: reason.trim(),
                                status:
                                  u.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE",
                              },
                            );
                          })
                        }
                      >
                        {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                      {u.mfaEnabled && can("user:write") && (
                        <details>
                          <summary className="cursor-pointer text-sm underline">
                            Recover authenticator
                          </summary>
                          <form
                            onSubmit={(e) => {
                              const d = fields(e);
                              void run(async () => {
                                await mutate(
                                  `/admin/users/${u.id}/mfa-reset`,
                                  "POST",
                                  { reason: d.get("reason") },
                                );
                              });
                            }}
                            className="mt-2 flex flex-wrap items-end gap-2"
                          >
                            <label>
                              Verified identity / recovery reason
                              <input
                                name="reason"
                                required
                                minLength={10}
                                maxLength={1000}
                                className={input}
                              />
                            </label>
                            <button className={button} disabled={busy}>
                              Reset MFA and revoke sessions
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    className={button}
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} · {total} customers
                  </span>
                  <button
                    className={button}
                    disabled={page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </section>
              <section className="mt-5 rounded-xl border p-4">
                <h2 className="text-xl font-semibold">Privacy requests</h2>
                {privacy.length === 0 && <p className="mt-3">No requests.</p>}
                {privacy.map((r) => (
                  <article key={r.id} className="mt-4 border-t pt-4">
                    <p>
                      {r.user.email} · {r.status}
                    </p>
                    <p className="my-2">{r.reason}</p>
                    {r.resolution && <p>{r.resolution}</p>}
                    {r.status === "OPEN" && can("user:write") && (
                      <form
                        onSubmit={(e) => {
                          const d = fields(e);
                          void run(async () => {
                            const result = (await mutate(
                              `/admin/users/privacy-requests/${r.id}`,
                              "PATCH",
                              Object.fromEntries(d),
                            )) as {
                              mediaCleanup?: {
                                queued?: string[];
                                retained?: string[];
                              };
                            };
                            if (result.mediaCleanup?.queued?.length)
                              return "Account data was anonymized. Private attachment erasure is queued for retry and access is blocked.";
                            if (result.mediaCleanup?.retained?.length)
                              return "Account data was anonymized. Some files remain referenced by other business records; review their retention in the media workbench.";
                          });
                        }}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <label>
                          Decision
                          <select name="status" className={input}>
                            <option value="REJECTED">
                              Reject with explanation
                            </option>
                            <option value="COMPLETED">
                              Delete account personal data
                            </option>
                          </select>
                        </label>
                        <label>
                          Resolution / retention explanation
                          <textarea
                            name="resolution"
                            minLength={10}
                            maxLength={2000}
                            required
                            className={input}
                          />
                        </label>
                        <p className="text-sm sm:col-span-2">
                          Completion removes profile, addresses, favorites,
                          subscriptions, support message personal data and
                          access. Unapproved applications are withdrawn;
                          approved company and order records are retained.
                          Active orders or company membership block completion.
                        </p>
                        <button disabled={busy} className={button}>
                          Resolve request
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
          {can("system:staff:read") && (
            <section className="mt-5 rounded-xl border p-4">
              <h2 className="text-xl font-semibold">Staff accounts</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  Search staff
                  <input
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className={input}
                  />
                </label>
                <label>
                  Staff page
                  <input
                    type="number"
                    min={1}
                    value={staffPage}
                    onChange={(e) =>
                      setStaffPage(Math.max(1, Number(e.target.value) || 1))
                    }
                    className={input}
                  />
                </label>
              </div>
              <button
                className={`${button} my-4`}
                disabled={busy}
                onClick={() => void run(loadStaff)}
              >
                Load staff administration
              </button>
              <fieldset
                disabled={
                  !can("system:staff:write") || !can("system:rbac:write")
                }
              >
                <form
                  onSubmit={(e) => {
                    const d = fields(e);
                    void run(async () => {
                      await mutate("/admin/staff", "POST", {
                        name: d.get("name"),
                        email: d.get("email"),
                        password: d.get("password"),
                        roleCodes: d.getAll("roleCodes"),
                      });
                      await loadStaff();
                    });
                  }}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <label>
                    Name
                    <input
                      name="name"
                      minLength={2}
                      maxLength={60}
                      required
                      className={input}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      className={input}
                    />
                  </label>
                  <label>
                    Initial password
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      maxLength={72}
                      required
                      className={input}
                    />
                  </label>
                  <fieldset className="sm:col-span-3 flex flex-wrap gap-4">
                    <legend className="mb-2">Roles</legend>
                    {roles.map((r) => (
                      <label key={r.id} className="flex gap-2">
                        <input
                          name="roleCodes"
                          value={r.code}
                          type="checkbox"
                        />
                        {r.name}
                      </label>
                    ))}
                  </fieldset>
                  <button disabled={busy} className={button}>
                    Create staff account
                  </button>
                </form>
                {staff.map((u) => (
                  <details key={u.id} className="mt-4 border-t pt-4">
                    <summary className="cursor-pointer">
                      {u.name} · {u.email} · {u.status}
                    </summary>
                    <form
                      onSubmit={(e) => {
                        const d = fields(e);
                        void run(async () => {
                          await mutate(`/admin/staff/${u.id}`, "PATCH", {
                            name: d.get("name"),
                            status: d.get("status"),
                            roleCodes: d.getAll("roleCodes"),
                          });
                          await loadStaff();
                        });
                      }}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                      <label>
                        Name
                        <input
                          name="name"
                          defaultValue={u.name}
                          minLength={2}
                          required
                          className={input}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          name="status"
                          defaultValue={u.status}
                          className={input}
                        >
                          <option>ACTIVE</option>
                          <option>DISABLED</option>
                        </select>
                      </label>
                      <fieldset className="sm:col-span-2 flex flex-wrap gap-3">
                        <legend>Roles</legend>
                        {roles.map((r) => (
                          <label key={r.id} className="flex gap-2">
                            <input
                              name="roleCodes"
                              value={r.code}
                              type="checkbox"
                              defaultChecked={u.roles?.some(
                                (x) => x.code === r.code,
                              )}
                            />
                            {r.name}
                          </label>
                        ))}
                      </fieldset>
                      <button disabled={busy} className={button}>
                        Save staff
                      </button>
                    </form>
                    <form
                      onSubmit={(e) => {
                        const d = fields(e);
                        void run(async () => {
                          await mutate(
                            `/admin/staff/${u.id}/permissions`,
                            "PATCH",
                            {
                              grant: d.getAll("grant"),
                              deny: d.getAll("deny"),
                            },
                          );
                          await loadStaff();
                        });
                      }}
                      className="mt-4"
                    >
                      <h3 className="font-semibold">
                        Individual permission overrides (super administrator)
                      </h3>
                      <div className="my-3 max-h-64 overflow-auto border rounded p-3">
                        {permissions.map((p) => (
                          <div
                            key={p.code}
                            className="grid grid-cols-[1fr_auto_auto] gap-3 py-1 text-sm"
                          >
                            <span>
                              {p.name} ({p.code})
                            </span>
                            <label>
                              <input
                                type="checkbox"
                                name="grant"
                                value={p.code}
                                defaultChecked={u.permissionOverrides?.grant?.includes(
                                  p.code,
                                )}
                              />{" "}
                              Grant
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                name="deny"
                                value={p.code}
                                defaultChecked={u.permissionOverrides?.deny?.includes(
                                  p.code,
                                )}
                              />{" "}
                              Deny
                            </label>
                          </div>
                        ))}
                      </div>
                      <button disabled={busy} className={button}>
                        Save overrides
                      </button>
                    </form>
                    <form
                      onSubmit={(e) => {
                        const d = fields(e);
                        void run(async () => {
                          await mutate(
                            `/admin/staff/${u.id}/mfa-reset`,
                            "POST",
                            {
                              reason: d.get("reason"),
                            },
                          );
                          await loadStaff();
                        });
                      }}
                      className="mt-4 flex flex-wrap items-end gap-3"
                    >
                      <label>
                        Authenticator recovery reason (super administrator)
                        <input
                          name="reason"
                          required
                          minLength={10}
                          maxLength={1000}
                          className={input}
                        />
                      </label>
                      <button disabled={busy} className={button}>
                        Reset MFA and revoke sessions
                      </button>
                    </form>
                    <form
                      onSubmit={(e) => {
                        const d = fields(e);
                        void run(async () => {
                          await mutate(
                            `/admin/staff/${u.id}/password`,
                            "PATCH",
                            {
                              password: d.get("password"),
                            },
                          );
                        });
                      }}
                      className="mt-4 flex flex-wrap items-end gap-3"
                    >
                      <label>
                        Replacement password
                        <input
                          type="password"
                          name="password"
                          minLength={8}
                          maxLength={72}
                          required
                          className={input}
                        />
                      </label>
                      <button disabled={busy} className={button}>
                        Reset password and revoke sessions
                      </button>
                    </form>
                  </details>
                ))}
              </fieldset>
            </section>
          )}
        </>
      )}
      {mode === "roles" && (
        <>
          <section className="rounded-xl border p-4">
            <h2 className="text-xl font-semibold">Create role</h2>
            <form
              onSubmit={(e) => {
                const d = fields(e);
                void run(async () => {
                  await mutate("/admin/roles", "POST", {
                    code: d.get("code"),
                    name: d.get("name"),
                    description: d.get("description"),
                    permissionCodes: d.getAll("permissionCodes"),
                  });
                });
              }}
              className="mt-4 grid gap-3 sm:grid-cols-3"
            >
              <label>
                Code
                <input
                  name="code"
                  pattern="[A-Z][A-Z0-9_]{1,31}"
                  required
                  className={input}
                />
              </label>
              <label>
                Name
                <input name="name" required maxLength={60} className={input} />
              </label>
              <label>
                Description
                <input name="description" maxLength={200} className={input} />
              </label>
              <fieldset className="sm:col-span-3 grid gap-2 sm:grid-cols-2">
                <legend className="mb-2">Permissions</legend>
                {permissions.map((p) => (
                  <label key={p.code} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="permissionCodes"
                      value={p.code}
                    />
                    {p.name} ({p.code})
                  </label>
                ))}
              </fieldset>
              <button disabled={busy} className={button}>
                Create role
              </button>
            </form>
          </section>
          {roles.map((r) => (
            <details key={r.id} className="mt-4 rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold">
                {r.name} ({r.code}) · {r.staffCount} staff
              </summary>
              <form
                onSubmit={(e) => {
                  const d = fields(e);
                  void run(async () => {
                    await mutate(`/admin/roles/${r.id}/permissions`, "PUT", {
                      permissionCodes: d.getAll("permissionCodes"),
                    });
                  });
                }}
                className="mt-4"
              >
                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend>Assigned permissions</legend>
                  {permissions.map((p) => (
                    <label key={p.code} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="permissionCodes"
                        value={p.code}
                        defaultChecked={r.permissionCodes.includes(p.code)}
                      />
                      {p.name} ({p.code})
                    </label>
                  ))}
                </fieldset>
                <p className="my-3 text-sm">
                  Permission changes take effect on the next API request.
                  SUPER_ADMIN always has full access.
                </p>
                <button
                  disabled={busy || r.code === "SUPER_ADMIN"}
                  className={button}
                >
                  Save permissions
                </button>
              </form>
            </details>
          ))}
        </>
      )}
      {mode === "audit" && (
        <section className="rounded-xl border p-4">
          <p>{total} matching events</p>
          {audit.map((a) => (
            <details key={a.id} className="border-b py-3">
              <summary className="cursor-pointer break-words">
                {new Date(a.createdAt).toLocaleString()} ·{" "}
                {a.actor?.email ?? a.actorKind} · {a.action}
              </summary>
              <p className="mt-2 text-sm">
                {a.entityType} / {a.entityId}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h3>Before</h3>
                  <pre className="whitespace-pre-wrap break-all rounded bg-neutral-50 p-3 text-xs">
                    {JSON.stringify(a.before, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3>After</h3>
                  <pre className="whitespace-pre-wrap break-all rounded bg-neutral-50 p-3 text-xs">
                    {JSON.stringify(a.after, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          ))}
          <div className="mt-4 flex gap-3">
            <button
              disabled={page === 1}
              className={button}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 20 >= total}
              className={button}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
