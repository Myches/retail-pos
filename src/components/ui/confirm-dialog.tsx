"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const confirmStyles =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-500"
      : "bg-violet-600 text-white hover:bg-violet-700 focus-visible:outline-violet-500";

  return (
    <div
      className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-950/15"
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 9v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>

        <h2
          id="confirm-dialog-title"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          {title}
        </h2>

        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          {description}
        </p>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmStyles}`}
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}