
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  generatedAt: string;
  today: {
    salesCount: number;
    revenuePesewas: number;
    estimatedGrossProfitPesewas: number;
    itemsMissingCost: number;
  };
  month: {
    salesCount: number;
    revenuePesewas: number;
    estimatedGrossProfitPesewas: number;
    itemsMissingCost: number;
  };
  lastSevenDays: {
    date: string;
    revenuePesewas: number;
  }[];
  lowStockProducts: {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }[];
  recentSales: {
    id: string;
    receiptNumber: string;
    totalPesewas: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    itemCount: number;
    items: {
      productName: string;
      quantity: number;
    }[];
  }[];
};

function formatMoney(pesewas: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesewas / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-GH", {
    weekday: "short",
    day: "numeric",
  });
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "revenue" | "sales" | "profit" | "stock" | "arrow";
  className?: string;
}) {
  const paths = {
    revenue: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    sales: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 8v6M23 11h-6" />
      </>
    ),
    profit: (
      <>
        <path d="m3 17 6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    stock: (
      <>
        <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
        <path d="M12 12v9M3 7.5 12 12l9-4.5" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  accent = "violet",
}: {
  title: string;
  value: string;
  description: string;
  icon: "revenue" | "sales" | "profit" | "stock";
  accent?: "violet" | "blue" | "emerald" | "amber";
}) {
  const accents = {
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon name={icon} />
        </div>
      </div>

      <p className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-[27px]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-64 max-w-full rounded bg-slate-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>

      <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
      <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/reports", {
          cache: "no-store",
        });

        const result = await response.json();

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (response.status === 403) {
          window.location.replace("/checkout");
          return;
        }

        if (!response.ok) {
          throw new Error(result.error ?? "Could not load dashboard.");
        }

        if (!cancelled) {
          setData(result as DashboardData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Something went wrong."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const highestDailyRevenue = Math.max(
    1,
    ...(data?.lastSevenDays.map((day) => day.revenuePesewas) ?? [])
  );

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl font-bold text-red-600">
          !
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Unable to load dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-9">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            Overview
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Here's what's happening with your store.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2" />
            </svg>
            Refresh
          </button>

          <Link
            href="/checkout"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700"
          >
            <span className="text-lg leading-none">+</span>
            New sale
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Refresh failed. Showing the last successfully loaded data.
        </div>
      )}

      {/* Today's metrics */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Today's performance</h2>
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            Today
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Sales revenue"
            value={formatMoney(data.today.revenuePesewas)}
            description="Revenue from completed sales"
            icon="revenue"
            accent="violet"
          />
          <MetricCard
            title="Transactions"
            value={String(data.today.salesCount)}
            description="Completed receipts today"
            icon="sales"
            accent="blue"
          />
          <MetricCard
            title="Estimated gross profit"
            value={formatMoney(data.today.estimatedGrossProfitPesewas)}
            description={
              data.today.itemsMissingCost > 0
                ? `${data.today.itemsMissingCost} sale item(s) missing cost data`
                : "Based on recorded product costs"
            }
            icon="profit"
            accent="emerald"
          />
          <MetricCard
            title="Low-stock products"
            value={String(data.lowStockProducts.length)}
            description="Products at or below their stock threshold"
            icon="stock"
            accent="amber"
          />
        </div>
      </section>

      {/* Monthly metrics */}
      <section>
        <SectionHeading
          title="Monthly performance"
          description="Your store's performance from the beginning of this month."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Monthly revenue"
            value={formatMoney(data.month.revenuePesewas)}
            description="Completed sales this month"
            icon="revenue"
            accent="violet"
          />
          <MetricCard
            title="Monthly transactions"
            value={String(data.month.salesCount)}
            description="Completed receipts this month"
            icon="sales"
            accent="blue"
          />
          <MetricCard
            title="Estimated gross profit"
            value={formatMoney(data.month.estimatedGrossProfitPesewas)}
            description={
              data.month.itemsMissingCost > 0
                ? `${data.month.itemsMissingCost} sale item(s) missing cost data`
                : "Before overheads and other expenses"
            }
            icon="profit"
            accent="emerald"
          />
        </div>
      </section>

      {/* Seven-day revenue */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          title="Revenue overview"
          description="Daily revenue from completed sales over the last seven days."
        />

        <div className="space-y-5">
          {data.lastSevenDays.map((day) => {
            const percentage =
              day.revenuePesewas > 0
                ? Math.max(
                    2,
                    (day.revenuePesewas / highestDailyRevenue) * 100
                  )
                : 0;

            return (
              <div
                key={day.date}
                className="grid grid-cols-[55px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[75px_minmax(0,1fr)_130px]"
              >
                <span className="text-xs font-medium text-slate-500 sm:text-sm">
                  {formatDay(day.date)}
                </span>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <span className="col-span-2 text-right text-xs font-semibold tabular-nums text-slate-700 sm:col-span-1 sm:text-sm">
                  {formatMoney(day.revenuePesewas)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Low stock */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <SectionHeading
            title="Low-stock alerts"
            description="Products that may need restocking."
            action={
              <Link
                href="/inventory"
                className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 transition hover:text-violet-900"
              >
                Manage inventory
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            }
          />

          {data.lowStockProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-5 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                All stock levels look good
              </p>
              <p className="mt-1 text-xs text-slate-500">
                No products are currently at or below their stock threshold.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3 pr-4 font-semibold">Product</th>
                    <th className="py-3 pr-4 font-semibold">SKU</th>
                    <th className="py-3 pr-4 font-semibold">Available stock</th>
                    <th className="py-3 font-semibold">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="py-4 pr-4 font-semibold text-slate-800">
                        {product.name}
                      </td>
                      <td className="py-4 pr-4 text-slate-500">
                        {product.sku}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                          {product.stockQuantity} left
                        </span>
                      </td>
                      <td className="py-4 text-slate-600">
                        {product.lowStockThreshold}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Recent transactions */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <SectionHeading
            title="Recent transactions"
            description="The latest eight receipts recorded in your store."
            action={
              <Link
                href="/sales"
                className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 transition hover:text-violet-900"
              >
                View all sales
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            }
          />

          {data.recentSales.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No transactions yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Completed sales will appear here.
              </p>
              <Link
                href="/checkout"
                className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Start a sale
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-3 pr-4 font-semibold">Receipt</th>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Items</th>
                    <th className="py-3 pr-4 font-semibold">Payment</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50/70"
                    >
                      <td className="py-4 pr-4 font-semibold text-slate-800">
                        {sale.receiptNumber}
                      </td>

                      <td className="whitespace-nowrap py-4 pr-4 text-xs text-slate-500">
                        {formatDate(sale.createdAt)}
                        <span className="ml-1.5 text-slate-400">
                          {formatTime(sale.createdAt)}
                        </span>
                      </td>

                      <td className="max-w-[240px] py-4 pr-4">
                        {sale.items?.length ? (
                          <div className="space-y-1">
                            {sale.items.slice(0, 3).map((item, index) => (
                              <p
                                key={`${sale.id}-${index}`}
                                className="truncate text-xs text-slate-600"
                              >
                                {item.productName}
                                <span className="ml-1 font-medium text-slate-400">
                                  × {item.quantity}
                                </span>
                              </p>
                            ))}
                            {sale.items.length > 3 && (
                              <p className="text-[11px] font-medium text-violet-600">
                                +{sale.items.length - 3} more
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No item details
                          </span>
                        )}
                      </td>

                      <td className="py-4 pr-4 text-xs capitalize text-slate-600">
                        {sale.paymentMethod.replace(/_/g, " ")}
                      </td>

                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-700">
                          {sale.status.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="whitespace-nowrap py-4 text-right font-bold tabular-nums text-slate-900">
                        {formatMoney(sale.totalPesewas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-400">
        Figures are calculated from the current local database. Estimated
        gross profit is based on recorded product costs and excludes
        overheads and other expenses.
      </footer>
    </div>
  );
}
