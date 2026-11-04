
"use client";

import { useCallback, useEffect, useState } from "react";

type SaleItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePesewas: number;
  lineTotalPesewas: number;
};

type Payment = {
  id: string;
  method: string;
  amountPesewas: number;
  reference: string | null;
  createdAt: string;
};

type ReturnItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPricePesewas: number;
  restocked: boolean;
};

type SaleReturn = {
  id: string;
  returnNumber: string;
  refundAmountPesewas: number;
  refundMethod: string;
  reason: string | null;
  createdAt: string;
  items: ReturnItem[];
};

type Sale = {
  id: string;
  receiptNumber: string;
  staff: {
    username: string;
  } | null;
  subtotalPesewas: number;
  totalPesewas: number;
  amountPaidPesewas: number;
  changePesewas: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
  returns: SaleReturn[];
};

type DailySummary = {
  count: number;
  totalPesewas: number;
};

type BusinessSettings = {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptFooter: string | null;
};

const money = (pesewas: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(pesewas / 100);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function paymentLabel(method: string) {
  return method.replaceAll("_", " ");
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>({
      businessName: "My Shop",
      address: null,
      phone: null,
      email: null,
      receiptFooter: null,
    });

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [count, setCount] = useState(0);

  const [dailySummary, setDailySummary] = useState<DailySummary>({
    count: 0,
    totalPesewas: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search.trim()) params.set("q", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/sales?${params.toString()}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not load sales history.");
      }

      const data = await response.json();

      setSales(data.sales ?? []);
      setCount(data.count ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setDailySummary(
        data.dailySummary ?? {
          count: 0,
          totalPesewas: 0,
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load sales. Please refresh the page."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, from, to]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    let cancelled = false;

    async function loadBusinessSettings() {
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();

          if (!cancelled && data.settings) {
            setBusinessSettings(data.settings);
          }
        }
      } catch (error) {
        console.error("Could not load business settings:", error);
      }
    }

    void loadBusinessSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateFrom(value: string) {
    setFrom(value);
    setPage(1);
  }

  function updateTo(value: string) {
    setTo(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function printReceipt(sale: Sale) {
    setSelectedReceipt(sale);

    window.setTimeout(() => {
      window.print();
    }, 100);
  }

  const hasFilters = Boolean(search || from || to);

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-[#172033] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-semibold text-[#6d4aff]">
            Sales management
          </p>
          <div className="mt-1 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Sales History
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Review transactions, find receipts and manage sales records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadSales()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              >
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadSales()}
              className="font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e9e7f2] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Sales today
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1edff] text-[#6d4aff]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M4 5h16v15H4zM8 3v4M16 3v4M4 10h16" />
                  <path d="M8 14h3M8 17h6" />
                </svg>
              </span>
            </div>

            {loading ? (
              <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <p className="mt-3 text-3xl font-bold tracking-tight">
                {dailySummary.count}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              Transactions recorded today
            </p>
          </div>

          <div className="rounded-2xl border border-[#e9e7f2] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Today's sales total
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
            </div>

            {loading ? (
              <div className="mt-4 h-9 w-36 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-700">
                {money(dailySummary.totalPesewas)}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              Gross sales before refunds
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e9e7f2] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Transactions</h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? "Loading transactions..."
                  : `${count} matching sale${count === 1 ? "" : "s"}`}
              </p>
            </div>

            <span className="self-start rounded-full bg-[#f1edff] px-3 py-1 text-xs font-semibold text-[#6d4aff]">
              20 per page
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="receiptSearch"
                className="block text-sm font-medium text-slate-700"
              >
                Search receipt
              </label>
              <div className="relative mt-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  id="receiptSearch"
                  type="search"
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="e.g. POS-20261103"
                  className="w-full rounded-xl border border-slate-200 bg-[#fbfbfd] py-3 pl-9 pr-3 text-sm outline-none transition focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="dateFrom"
                className="block text-sm font-medium text-slate-700"
              >
                From date
              </label>
              <input
                id="dateFrom"
                type="date"
                value={from}
                onChange={(event) => updateFrom(event.target.value)}
                max={to || undefined}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfbfd] p-3 text-sm outline-none transition focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
              />
            </div>

            <div>
              <label
                htmlFor="dateTo"
                className="block text-sm font-medium text-slate-700"
              >
                To date
              </label>
              <input
                id="dateTo"
                type="date"
                value={to}
                onChange={(event) => updateTo(event.target.value)}
                min={from || undefined}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#fbfbfd] p-3 text-sm outline-none transition focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-xl border border-slate-100 p-5"
                >
                  <div className="flex justify-between gap-4">
                    <div className="w-1/2">
                      <div className="h-4 w-3/4 rounded bg-slate-100" />
                      <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                    <div className="w-1/4">
                      <div className="ml-auto h-4 w-3/4 rounded bg-slate-100" />
                      <div className="ml-auto mt-3 h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f1edff] text-[#6d4aff]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6"
                >
                  <path d="M6 3h9l4 4v14H6z" />
                  <path d="M14 3v5h5M9 13h7M9 17h7" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-slate-700">
                No sales found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {hasFilters
                  ? "Try changing your search or date filters."
                  : "Completed transactions will appear here."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-semibold text-[#6d4aff] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {sales.map((sale) => (
                <details
                  key={sale.id}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-[#cfc4ff]"
                >
                  <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 p-4 transition hover:bg-[#fbfaff] sm:flex-row sm:items-center sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1edff] text-[#6d4aff]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-5 w-5"
                        >
                          <path d="M6 3h9l4 4v14H6z" />
                          <path d="M14 3v5h5M9 13h7M9 17h7" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-slate-800">
                          {sale.receiptNumber}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {dateTime(sale.createdAt)}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-400">
                          {paymentLabel(sale.paymentMethod)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="sm:text-right">
                        <p className="font-bold text-slate-900">
                          {money(sale.totalPesewas)}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-500">
                          {sale.status.replaceAll("_", " ")}
                        </p>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-4 w-4"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-slate-100 bg-[#fafbfe] p-4 sm:p-5">
                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="text-xs text-slate-400">Cashier</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {sale.staff?.username ?? "Staff not recorded"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="text-xs text-slate-400">Receipt number</p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-700">
                          {sale.receiptNumber}
                        </p>
                      </div>
                    </div>

                    <h3 className="mb-2 text-sm font-bold text-slate-800">
                      Items purchased
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Product</th>
                            <th className="px-4 py-3 font-semibold">Quantity</th>
                            <th className="px-4 py-3 font-semibold">Unit price</th>
                            <th className="px-4 py-3 text-right font-semibold">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sale.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800">
                                  {item.productName}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  SKU: {item.sku}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {money(item.unitPricePesewas)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                {money(item.lineTotalPesewas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
                      <h3 className="mb-3 text-sm font-bold text-slate-800">
                        Sale summary
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Subtotal</span>
                          <span>{money(sale.subtotalPesewas)}</span>
                        </div>
                        <div className="flex justify-between gap-3 font-bold">
                          <span>Total</span>
                          <span>{money(sale.totalPesewas)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Amount received</span>
                          <span>{money(sale.amountPaidPesewas)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Change</span>
                          <span>{money(sale.changePesewas)}</span>
                        </div>
                      </div>
                    </div>

                    {sale.payments?.length > 0 && (
                      <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
                        <h3 className="font-bold text-slate-800">
                          Payment records
                        </h3>
                        {sale.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="mt-3 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="capitalize text-slate-600">
                                {paymentLabel(payment.method)}
                              </span>
                              <strong>
                                {money(payment.amountPesewas)}
                              </strong>
                            </div>
                            {payment.reference && (
                              <p className="mt-1 break-all text-xs text-slate-400">
                                Reference: {payment.reference}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-400">
                              {dateTime(payment.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {sale.returns?.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <h3 className="font-bold text-amber-900">
                          Returns and refunds
                        </h3>
                        {sale.returns.map((saleReturn) => (
                          <div
                            key={saleReturn.id}
                            className="mt-3 border-b border-amber-200 pb-3 text-sm last:border-0 last:pb-0"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <strong className="text-amber-950">
                                {saleReturn.returnNumber}
                              </strong>
                              <strong className="text-amber-900">
                                {money(saleReturn.refundAmountPesewas)}
                              </strong>
                            </div>
                            <p className="mt-1 capitalize text-amber-900">
                              Refund method: {paymentLabel(saleReturn.refundMethod)}
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              {dateTime(saleReturn.createdAt)}
                            </p>
                            {saleReturn.reason && (
                              <p className="mt-2 text-amber-900">
                                Reason: {saleReturn.reason}
                              </p>
                            )}
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                              {saleReturn.items.map((item) => (
                                <li key={item.id}>
                                  {item.productName} — Qty {item.quantity}
                                  {item.restocked
                                    ? " (restocked)"
                                    : " (not restocked)"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => printReceipt(sale)}
                      className="no-print mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6d4aff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5836e6]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                      >
                        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <path d="M6 14h12v7H6zM17 12h.01" />
                      </svg>
                      Reprint receipt
                    </button>
                  </div>
                </details>
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {selectedReceipt && (
          <section className="print-receipt mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="receipt-content mx-auto max-w-md">
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {businessSettings.businessName}
                </h2>
                {businessSettings.address && (
                  <p className="text-sm text-gray-600">
                    {businessSettings.address}
                  </p>
                )}
                {businessSettings.phone && (
                  <p className="text-sm text-gray-600">
                    Tel: {businessSettings.phone}
                  </p>
                )}
                {businessSettings.email && (
                  <p className="text-sm text-gray-600">
                    {businessSettings.email}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600">
                  Sales receipt
                </p>
              </div>

              <div className="my-4 border-t border-dashed border-gray-400" />

              <p className="text-sm">
                <strong>Receipt:</strong> {selectedReceipt.receiptNumber}
              </p>
              <p className="text-sm">
                <strong>Date:</strong>{" "}
                {new Date(selectedReceipt.createdAt).toLocaleString("en-GH")}
              </p>
              <p className="text-sm">
                <strong>Cashier:</strong>{" "}
                {selectedReceipt.staff?.username ?? "Staff"}
              </p>

              <div className="my-4 border-t border-dashed border-gray-400" />

              <div className="space-y-3">
                {selectedReceipt.items.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="font-semibold">{item.productName}</div>
                    <div className="flex justify-between gap-3">
                      <span>
                        {item.quantity} × {money(item.unitPricePesewas)}
                      </span>
                      <span className="font-medium">
                        {money(item.lineTotalPesewas)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      SKU: {item.sku}
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-dashed border-gray-400" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(selectedReceipt.subtotalPesewas)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{money(selectedReceipt.totalPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount paid</span>
                  <span>{money(selectedReceipt.amountPaidPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{money(selectedReceipt.changePesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment method</span>
                  <span className="capitalize">
                    {paymentLabel(selectedReceipt.paymentMethod)}
                  </span>
                </div>
              </div>

              <p className="mt-6 text-center text-sm">
                {businessSettings.receiptFooter ||
                  "Thank you for shopping with us!"}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
