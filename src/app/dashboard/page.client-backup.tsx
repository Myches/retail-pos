
"use client";

import { useEffect, useState } from "react";
import LogoutButton from "@/components/logout-button";

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

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </section>
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
          throw new Error(
            result.error ?? "Could not load dashboard."
          );
        }

        if (!cancelled) {
          setData(result as DashboardData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading && !data) {
    return (
      <main className="mx-auto max-w-7xl p-6">
        <p className="text-gray-600">Loading your dashboard...</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-7xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </p>
        <button
          onClick={() => setRefreshKey((key) => key + 1)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-white"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!data) return null;

  const highestDailyRevenue = Math.max(
    1,
    ...data.lastSevenDays.map((day) => day.revenuePesewas)
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">
            RETAIL POS
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Your shop&apos;s sales and stock at a glance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/checkout"
            className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
          >
            New sale
          </a>
          <button
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Refresh
          </button>
          <LogoutButton />
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Refresh failed. Showing the last successfully loaded data.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Today</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Sales revenue"
            value={formatMoney(data.today.revenuePesewas)}
            description="Completed sales today"
          />
          <MetricCard
            title="Transactions"
            value={String(data.today.salesCount)}
            description="Completed receipts today"
          />
          <MetricCard
            title="Estimated gross profit"
            value={formatMoney(
              data.today.estimatedGrossProfitPesewas
            )}
            description={
              data.today.itemsMissingCost > 0
                ? `${data.today.itemsMissingCost} sale item(s) missing cost data`
                : "Based on recorded product costs"
            }
          />
          <MetricCard
            title="Low-stock products"
            value={String(data.lowStockProducts.length)}
            description="Products at or below their stock threshold"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          This month
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Monthly revenue"
            value={formatMoney(data.month.revenuePesewas)}
            description="From the first day of this month"
          />
          <MetricCard
            title="Monthly transactions"
            value={String(data.month.salesCount)}
            description="Completed sales this month"
          />
          <MetricCard
            title="Estimated gross profit"
            value={formatMoney(
              data.month.estimatedGrossProfitPesewas
            )}
            description={
              data.month.itemsMissingCost > 0
                ? `${data.month.itemsMissingCost} sale item(s) missing cost data`
                : "Before overheads and other expenses"
            }
          />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">
            Sales over the last 7 days
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Daily revenue from completed sales.
          </p>
        </div>

        <div className="space-y-4">
          {data.lastSevenDays.map((day) => (
            <div
              key={day.date}
              className="grid grid-cols-[76px_minmax(0,1fr)_110px] items-center gap-3"
            >
              <span className="text-sm text-gray-600">
                {formatDay(day.date)}
              </span>

              <div className="h-5 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded bg-blue-600"
                  style={{
                    width: `${
                      (day.revenuePesewas / highestDailyRevenue) *
                      100
                    }%`,
                  }}
                />
              </div>

              <span className="text-right text-sm font-medium">
                {formatMoney(day.revenuePesewas)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Low-stock alerts</h2>
            <p className="mt-1 text-sm text-gray-500">
              Check these products before the next sale.
            </p>
          </div>
          <a
            href="/inventory"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Manage inventory
          </a>
        </div>

        {data.lowStockProducts.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            No products are currently at or below their stock threshold.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-3 pr-4 font-medium">Product</th>
                  <th className="py-3 pr-4 font-medium">SKU</th>
                  <th className="py-3 pr-4 font-medium">In stock</th>
                  <th className="py-3 font-medium">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">
                      {product.name}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {product.sku}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-red-700">
                      {product.stockQuantity}
                    </td>
                    <td className="py-3">
                      {product.lowStockThreshold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Recent transactions
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              The 8 most recent receipts.
            </p>
          </div>
          <a
            href="/sales"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            View sales history
          </a>
        </div>

        {data.recentSales.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            No transactions have been recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-3 pr-4 font-medium">Receipt</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Items</th>
                  <th className="py-3 pr-4 font-medium">Payment</th>
                  <th className="py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">
                      {sale.receiptNumber}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-gray-600">
                      {formatDate(sale.createdAt)}{" "}
                      {formatTime(sale.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
  <div className="space-y-1">
    {sale.items?.length ? (
      sale.items.map((item, index) => (
        <div key={`${sale.id}-${index}`} className="whitespace-nowrap">
          {item.productName} <span className="text-gray-500"> {item.quantity} ×{" "}</span>
        </div>
      ))
    ) : (
      <span className="text-gray-500">No item details</span>
    )}
  </div>
</td>
                    <td className="py-3 pr-4 capitalize">
                      {sale.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right font-semibold">
                      {formatMoney(sale.totalPesewas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="text-xs text-gray-500">
        Figures are calculated from the current local database. Gross
        profit is an estimate and excludes overheads and expenses.
      </footer>
    </main>
  );
}




