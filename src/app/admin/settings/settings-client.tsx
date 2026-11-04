
"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

type BusinessSettings = {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptFooter: string | null;
};

const emptySettings: BusinessSettings = {
  businessName: "My Shop",
  address: "",
  phone: "",
  email: "",
  receiptFooter: "",
};

export default function SettingsClient() {
  const { showToast } = useToast();

  const [settings, setSettings] =
    useState<BusinessSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load settings.");
        }

        setSettings({
          businessName: data.settings.businessName,
          address: data.settings.address ?? "",
          phone: data.settings.phone ?? "",
          email: data.settings.email ?? "",
          receiptFooter: data.settings.receiptFooter ?? "",
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load settings."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  function updateField(field: keyof BusinessSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }

      setSettings({
        businessName: data.settings.businessName,
        address: data.settings.address ?? "",
        phone: data.settings.phone ?? "",
        email: data.settings.email ?? "",
        receiptFooter: data.settings.receiptFooter ?? "",
      });

      showToast("Business settings saved successfully.", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save settings.";

      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
          Administration
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Business settings
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage your shop information and customise the details displayed on
          printed receipts.
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

      <form onSubmit={saveSettings} className="space-y-6">
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
                <path d="M3 21h18M5 21V7l8-4v18m6 0V11l-6-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 9v.01M9 12v.01M9 15v.01M15 12v.01M15 15v.01M15 18v.01" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900">
                Shop information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                These details identify your business and can appear on
                customer receipts.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Business name <span className="text-red-500">*</span>
              </span>
              <input
                value={settings.businessName}
                onChange={(event) =>
                  updateField("businessName", event.target.value)
                }
                required
                maxLength={100}
                className={inputClass}
                placeholder="e.g. Michael's Store"
              />
              <span className="mt-1.5 block text-xs text-slate-400">
                Maximum 100 characters.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Business address
              </span>
              <textarea
                value={settings.address ?? ""}
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
                maxLength={250}
                rows={3}
                className={inputClass}
                placeholder="Shop location or address"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={settings.phone ?? ""}
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  maxLength={30}
                  className={inputClass}
                  placeholder="e.g. 024 000 0000"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email address
                </span>
                <input
                  type="email"
                  value={settings.email ?? ""}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  maxLength={254}
                  className={inputClass}
                  placeholder="shop@example.com"
                />
              </label>
            </div>
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
                <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
                <path d="M14 3v5h5M8 13h8m-8 4h8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900">
                Receipt settings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add a message to appear at the bottom of printed receipts.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Receipt footer
              </span>
              <textarea
                value={settings.receiptFooter ?? ""}
                onChange={(event) =>
                  updateField("receiptFooter", event.target.value)
                }
                maxLength={250}
                rows={3}
                className={inputClass}
                placeholder="e.g. Thank you for shopping with us!"
              />
              <span className="mt-1.5 block text-xs text-slate-400">
                Maximum 250 characters.
              </span>
            </label>

            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                Receipt preview
              </p>
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
                <p className="font-bold text-slate-900">
                  {settings.businessName || "Your business name"}
                </p>
                {settings.address && (
                  <p className="mt-1 text-xs text-slate-500">
                    {settings.address}
                  </p>
                )}
                {settings.phone && (
                  <p className="mt-1 text-xs text-slate-500">
                    {settings.phone}
                  </p>
                )}
                <div className="my-3 border-t border-dashed border-slate-300" />
                <p className="whitespace-pre-wrap text-xs text-slate-600">
                  {settings.receiptFooter || "Your receipt footer message will appear here."}
                </p>
              </div>
              <p className="mt-2 text-xs text-violet-700">
                Preview of your business identity and footer. The actual
                receipt layout remains unchanged.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12h8m-4-4v8" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Store currency
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Ghana cedi (GH₵)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Currency is fixed for this installation.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {saving ? "Saving changes..." : "Save settings"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
