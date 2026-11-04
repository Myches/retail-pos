
"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

type Backup = {
  filename: string;
  size: number;
  createdAt: string;
  verificationStatus: "VERIFIED" | "FAILED";
  verificationMessage: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function BackupsClient() {
  const { showToast } = useToast();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  const verifiedCount = backups.filter(
    (backup) => backup.verificationStatus === "VERIFIED"
  ).length;

  const failedCount = backups.filter(
    (backup) => backup.verificationStatus === "FAILED"
  ).length;

  const loadBackups = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/backups", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load backups.");
      }

      setBackups(data.backups);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load backups.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function createBackup() {
    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/backups", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create backup.");
      }

      setConfirmOpen(false);
      showToast(
        data.message || "Backup created successfully.",
        "success"
      );

      await loadBackups();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create backup.";

      setError(message);
      showToast(message, "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-600">
            System management
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Backup & Restore
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Protect your shop's production data and manage verified database
            backups.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">+</span>
          Create backup
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-bold">!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Total backups
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg text-violet-600">
              <span aria-hidden="true">▤</span>
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {loading ? "—" : backups.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Available backup files
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Verified backups
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">
              ✓
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {loading ? "—" : verifiedCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Passed database integrity checks
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Failed verification
            </p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg text-red-600">
              !
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">
            {loading ? "—" : failedCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Backups requiring attention
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-600">
              <span aria-hidden="true">▣</span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Create a database backup
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                Create a consistent SQLite backup while the POS is running.
                The backup script checks database integrity before reporting
                success.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={creating}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            Create backup now
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Backup storage location
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-700">
            Documents\RetailPOS-Backups
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 md:p-6">
          <div>
            <h2 className="font-semibold text-slate-900">
              Available backups
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review verification results and download backup files.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadBackups()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
              ▤
            </div>
            <h3 className="mt-3 font-semibold text-slate-800">
              No backups found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create your first backup to protect your shop's data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Backup file</th>
                  <th className="px-5 py-4 font-semibold">Date created</th>
                  <th className="px-5 py-4 font-semibold">Size</th>
                  <th className="px-5 py-4 font-semibold">Verification</th>
                  <th className="px-5 py-4 text-right font-semibold">
                    Download
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {backups.map((backup) => (
                  <tr
                    key={backup.filename}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="max-w-xs px-5 py-4">
                      <p className="break-all font-medium text-slate-800">
                        {backup.filename}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(backup.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatSize(backup.size)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          backup.verificationStatus === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {backup.verificationStatus === "VERIFIED"
                          ? "Verified"
                          : "Failed"}
                      </span>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                        {backup.verificationMessage}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <a
                        href={`/api/backups/${encodeURIComponent(backup.filename)}`}
                        className="inline-flex items-center gap-1 font-semibold text-violet-600 hover:text-violet-800"
                      >
                        Download
                        <span aria-hidden="true">↓</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && backups.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">
              Showing {backups.length} backup
              {backups.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-700">
            !
          </div>
          <div>
            <h2 className="font-semibold text-amber-950">
              Important: Restoring a backup
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Restoring replaces the current production database with an
              older backup. It must be done outside the running POS
              application.
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-3 text-sm text-amber-950">
          {[
            "Close the POS completely.",
            "Open PowerShell in your project folder.",
            "Run the restore script with the selected backup file.",
            "Type RESTORE only after checking the selected backup.",
            "Wait for the script to confirm that restoration succeeded.",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-5 border-t border-amber-200 pt-4 text-sm font-semibold text-amber-950">
          Never restore a backup while the POS is running.
        </p>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Create a production database backup?"
        description="This will create and verify a new backup of the production POS database. It will not replace or delete your current database."
        confirmLabel="Create backup"
        cancelLabel="Cancel"
        loading={creating}
        onConfirm={createBackup}
        onClose={() => {
          if (!creating) setConfirmOpen(false);
        }}
      />
    </main>
  );
}
