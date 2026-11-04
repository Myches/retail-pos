
"use client";

import { useEffect, useMemo, useState } from "react";

type SaleItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePesewas: number;
  lineTotalPesewas: number;
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

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSales() {
      try {
        const response = await fetch("/api/sales");

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load sales history.");
        }

        const data = await response.json();

        if (!cancelled) {
          setSales(data.sales ?? []);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Could not load sales. Please refresh the page.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSales();

    return () => {
      cancelled = true;
    };
  }, []);

  const [today, setToday] = useState<string | null>(null);

useEffect(() => {
  setToday(new Date().toDateString());
}, []);

const todaysSales = useMemo(
  () =>
    today === null
      ? []
      : sales.filter(
          (sale) => new Date(sale.createdAt).toDateString() === today
        ),
  [sales, today]
);

  const todaysTotal = todaysSales.reduce(
    (sum, sale) => sum + sale.totalPesewas,
    0
  );

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return sales;

    return sales.filter((sale) =>
      sale.receiptNumber.toLowerCase().includes(term)
    );
  }, [sales, search]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Retail POS
          </p>
          <h1 className="mt-1 text-3xl font-bold">Sales History</h1>
          <p className="mt-2 text-slate-600">
            Review completed sales and find receipts.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
          >
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sales today</p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "Loading..." : todaysSales.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Transactions recorded today
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Today's sales total</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {loading ? "Loading..." : money(todaysTotal)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Based on the latest 200 sales loaded
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-lg font-bold">Transactions</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredSales.length} sale(s) displayed
              </p>
            </div>

            <div className="w-full sm:max-w-sm">
              <label
                htmlFor="receiptSearch"
                className="block text-sm font-medium"
              >
                Search by receipt number
              </label>
              <input
                id="receiptSearch"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="e.g. POS-20261026"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading sales...
            </p>
          ) : filteredSales.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              {search
                ? "No receipts match your search."
                : "No sales have been recorded yet."}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredSales.map((sale) => (
                <details
                  key={sale.id}
                  className="rounded-lg border border-slate-200"
                >
                  <summary className="cursor-pointer list-none p-4 hover:bg-slate-50">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="break-all font-semibold">
                          {sale.receiptNumber}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {dateTime(sale.createdAt)}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="font-bold">
                          {money(sale.totalPesewas)}
                        </p>
                        <p className="mt-1 text-sm capitalize text-slate-500">
                          {sale.paymentMethod.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t bg-slate-50 p-4">
                    <div className="mb-4 rounded-lg bg-white p-3 text-sm">
  <span className="text-slate-500">Served by: </span>
  <span className="font-semibold">
    {sale.staff?.username ?? "Staff not recorded"}
  </span>
</div>
                    <h3 className="mb-3 font-semibold">Items purchased</h3>

                    {sale.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 border-b border-slate-200 py-3 last:border-b-0"
                      >
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-slate-500">
                            SKU: {item.sku} · Qty: {item.quantity} ×{" "}
                            {money(item.unitPricePesewas)}
                          </p>
                        </div>
                        <p className="whitespace-nowrap font-medium">
                          {money(item.lineTotalPesewas)}
                        </p>
                      </div>
                    ))}

                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{money(sale.subtotalPesewas)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{money(sale.totalPesewas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount received</span>
                        <span>{money(sale.amountPaidPesewas)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Change</span>
                        <span>{money(sale.changePesewas)}</span>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

