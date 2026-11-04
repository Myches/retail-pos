
"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

type Staff = {
  id: string;
  username: string;
  role: "ADMIN" | "CASHIER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    sales: number;
  };
};

export default function StaffClient() {
  const { showToast } = useToast();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CASHIER">("CASHIER");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<Staff | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<Staff | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load staff.");
      }

      setStaff(data.staff);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load staff.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create staff account.");
      }

      setUsername("");
      setPassword("");
      setRole("CASHIER");

      showToast("Staff account created successfully.", "success");
      await loadStaff();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not create staff account.";

      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateStaff(
    id: string,
    changes: {
      role?: "ADMIN" | "CASHIER";
      isActive?: boolean;
      password?: string;
    }
  ) {
    setError("");
    setUpdatingId(id);

    try {
      const response = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update staff account.");
      }

      showToast("Staff account updated successfully.", "success");
      await loadStaff();
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not update staff account.";

      setError(message);
      showToast(message, "error");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function confirmToggleStatus() {
    if (!toggleTarget) return;

    const target = toggleTarget;
    const updated = await updateStaff(target.id, {
      isActive: !target.isActive,
    });

    if (updated) {
      setToggleTarget(null);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordTarget) return;

    if (newPassword.length < 8 || newPassword.length > 200) {
      setError("Password must be between 8 and 200 characters.");
      return;
    }

    setResettingPassword(true);
    setError("");

    const updated = await updateStaff(passwordTarget.id, {
      password: newPassword,
    });

    if (updated) {
      setPasswordTarget(null);
      setNewPassword("");
    }

    setResettingPassword(false);
  }

  const adminCount = staff.filter((member) => member.role === "ADMIN").length;
  const cashierCount = staff.filter(
    (member) => member.role === "CASHIER"
  ).length;
  const activeCount = staff.filter((member) => member.isActive).length;

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
          Administration
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Staff management
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Create staff accounts and manage administrator and cashier access.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <svg
            className="mt-0.5 h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3h.01" strokeLinecap="round" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Total accounts
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.5a4 4 0 0 1 0 7.5m3 10v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {staff.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Registered staff accounts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Administrators
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {adminCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Accounts with admin roles
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Active accounts
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {cashierCount} cashier account{cashierCount === 1 ? "" : "s"} in total
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M12 5v14m-7-7h14" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-900">
              Add staff member
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a login account for a new administrator or cashier.
            </p>
          </div>
        </div>

        <form onSubmit={createStaff} className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Username
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={50}
              required
              className={inputClass}
              placeholder="e.g. cashier01"
              autoComplete="off"
            />
            <span className="mt-1.5 block text-xs text-slate-400">
              Between 3 and 50 characters.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Temporary password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={200}
              required
              className={inputClass}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
            <span className="mt-1.5 block text-xs text-slate-400">
              Choose a secure temporary password.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Account role
            </span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "ADMIN" | "CASHIER")
              }
              className={inputClass}
            >
              <option value="CASHIER">Cashier</option>
              <option value="ADMIN">Administrator</option>
            </select>
            <span className="mt-1.5 block text-xs text-slate-400">
              Administrators have access to management features.
            </span>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {saving ? "Creating account..." : "Create staff account"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2 className="font-bold text-slate-900">
              Staff accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {staff.length} account{staff.length === 1 ? "" : "s"} registered
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStaff()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 p-5 sm:p-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7v6m-3-3h6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-3 font-semibold text-slate-900">
              No staff accounts found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first staff account using the form above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Staff member</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Sales</th>
                  <th className="px-5 py-3 font-semibold">Account actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold uppercase text-violet-700">
                          {member.username.slice(0, 1)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {member.username}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Joined{" "}
                            {new Date(member.createdAt).toLocaleDateString("en-GH")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.role === "ADMIN"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {member.role === "ADMIN" ? "Administrator" : "Cashier"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.isActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-700">
                      {member._count.sales}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Role for ${member.username}`}
                          value={member.role}
                          disabled={updatingId === member.id}
                          onChange={(event) =>
                            void updateStaff(member.id, {
                              role: event.target.value as
                                | "ADMIN"
                                | "CASHIER",
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
                        >
                          <option value="CASHIER">Cashier</option>
                          <option value="ADMIN">Admin</option>
                        </select>

                        <button
                          type="button"
                          disabled={updatingId === member.id}
                          onClick={() => setToggleTarget(member)}
                          className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                            member.isActive
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {member.isActive ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === member.id}
                          onClick={() => {
                            setError("");
                            setNewPassword("");
                            setPasswordTarget(member);
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.isActive ? "Deactivate staff account?" : "Activate staff account?"}
        description={
          toggleTarget
            ? toggleTarget.isActive
              ? `Deactivate ${toggleTarget.username}? This account will no longer be able to access the POS.`
              : `Activate ${toggleTarget.username}? This account will regain access to the POS.`
            : ""
        }
        confirmLabel={
          toggleTarget?.isActive ? "Deactivate account" : "Activate account"
        }
        variant={toggleTarget?.isActive ? "danger" : "default"}
        loading={!!toggleTarget && updatingId === toggleTarget.id}
        onConfirm={confirmToggleStatus}
        onClose={() => {
          if (!updatingId) setToggleTarget(null);
        }}
      />

      {passwordTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !resettingPassword) {
              setPasswordTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" strokeLinecap="round" />
                  </svg>
                </div>
                <h2
                  id="reset-password-title"
                  className="mt-4 text-lg font-bold text-slate-900"
                >
                  Reset password
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Set a new password for{" "}
                  <span className="font-semibold text-slate-700">
                    {passwordTarget.username}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                disabled={resettingPassword}
                onClick={() => setPasswordTarget(null)}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m18 6-12 12M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={resetPassword} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  New password
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  maxLength={200}
                  required
                  autoFocus
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="Enter a new password"
                />
                <span className="mt-1.5 block text-xs text-slate-400">
                  Must be between 8 and 200 characters.
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={resettingPassword}
                  onClick={() => setPasswordTarget(null)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {resettingPassword && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {resettingPassword ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
