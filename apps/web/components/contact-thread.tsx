"use client";
import { useEffect, useState } from "react";
import { secureApiFetch } from "../lib/secure-api";

type Assignment = {
  assignedTo: string | null;
  assignedTeam: string | null;
  priority: string;
  tags: string[];
};
export function ContactThread({
  id,
  mfa,
  reload,
  current,
}: {
  id: string;
  mfa: string;
  reload: () => Promise<void>;
  current: Assignment;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    void secureApiFetch<Array<{ id: string; name: string }>>(
      "staff",
      "/contacts/assignees",
    )
      .then(setStaff)
      .catch(() =>
        setMessage(
          "Staff list unavailable. Current assignment is retained; reload before assigning another person.",
        ),
      );
  }, []);
  async function save(path: string, method: string, body: unknown) {
    if (!/^\d{6}$/.test(mfa))
      throw new Error("Enter the current 6-digit MFA code.");
    await secureApiFetch("staff", path, {
      method,
      headers: { "x-mfa-code": mfa },
      body: JSON.stringify(body),
    });
  }
  return (
    <div className="mt-5 border-t pt-5">
      <form
        key={`${current.assignedTo}:${current.assignedTeam}:${current.priority}:${current.tags.join(",")}`}
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await save(`/contacts/${id}`, "PATCH", {
              assignedTo: f.get("assignedTo"),
              assignedTeam: f.get("assignedTeam"),
              priority: f.get("priority"),
              tags: String(f.get("tags") ?? "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            });
            setMessage("Assignment updated.");
            await reload();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to save assignment.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Assigned to
          <select
            name="assignedTo"
            defaultValue={current.assignedTo ?? ""}
            className="mt-1 block rounded border p-2"
          >
            <option value="">Unassigned</option>
            {current.assignedTo &&
              !staff.some((s) => s.id === current.assignedTo) && (
                <option value={current.assignedTo}>
                  Current staff ({current.assignedTo})
                </option>
              )}
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team
          <input
            name="assignedTeam"
            maxLength={100}
            defaultValue={current.assignedTeam ?? ""}
            className="mt-1 block rounded border p-2"
          />
        </label>
        <label>
          Priority
          <select
            name="priority"
            defaultValue={current.priority}
            className="mt-1 block rounded border p-2"
          >
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Tags (comma separated)
          <input
            name="tags"
            defaultValue={current.tags.join(", ")}
            className="mt-1 block rounded border p-2"
          />
        </label>
        <button disabled={busy} className="rounded border px-4 py-2">
          Save assignment
        </button>
      </form>
      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          setBusy(true);
          try {
            await save(`/contacts/${id}/replies`, "POST", {
              text: f.get("text"),
              internal: f.get("internal") === "on",
            });
            setMessage("Message saved.");
            form.reset();
            await reload();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to save message.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Reply or internal note
          <textarea
            required
            name="text"
            minLength={2}
            maxLength={4000}
            className="mt-2 w-full rounded border p-3"
            rows={3}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-5">
          <label>
            <input type="checkbox" name="internal" defaultChecked /> Internal
            note (uncheck to email customer)
          </label>
          <button disabled={busy} className="rounded border px-4 py-2">
            Save message
          </button>
        </div>
      </form>
      <p role="status" className="mt-3">
        {message}
      </p>
    </div>
  );
}
