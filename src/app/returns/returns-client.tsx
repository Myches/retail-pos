
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePesewas: number;
  lineTotalPesewas: number;
};

type Sale = {
  id: string;
  receiptNumber: string;
  totalPesewas: number;
  status: string;
  createdAt: string;
  paymentMethod: string;
  items: SaleItem[];
};

type ReturnableItem = SaleItem & {
  alreadyReturned: number;
  remainingQuantity: number;
};

type ReturnResult = {
  returnNumber: string;
  receiptNumber: string;
  refundAmountPesewas: number;
};

const allowedRefundMethods = ["cash", "mobile_money", "card"];

function formatMoney(pesewas: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesewas / 100);
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "Cash";
    case "mobile_money":
      return "Mobile Money";
    case "card":
      return "Card";
    default:
      return method.replaceAll("_", " ");
  }
}

export default function ReturnsPage() {
  const router = useRouter();

  const [receiptNumber, setReceiptNumber] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [restockChoices, setRestockChoices] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ReturnResult | null>(null);

  function handleAccessDenied(status: number) {
    if (status === 401) {
      window.location.replace("/login");
      return true;
    }

    if (status === 403) {
      router.replace("/dashboard");
      return true;
    }

    return false;
  }

  async function findSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess(null);
    setSale(null);
    setReturnableItems([]);
    setQuantities({});
    setRestockChoices({});

    if (!receiptNumber.trim()) {
      setError("Enter a receipt number.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/sales?q=${encodeURIComponent(receiptNumber.trim())}`,
        { cache: "no-store" }
      );

      if (handleAccessDenied(response.status)) return;

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not search sales.");
      }

      const sales: Sale[] = Array.isArray(result)
        ? result
        : Array.isArray(result.sales)
          ? result.sales
          : [];

      const found = sales.find(
        (item) =>
          item.receiptNumber.toLowerCase() ===
          receiptNumber.trim().toLowerCase()
      );

      if (!found) {
        throw new Error("Receipt not found. Enter the full receipt number.");
      }

      if (found.status !== "completed") {
        throw new Error("Only completed sales can be returned.");
      }

      if (!allowedRefundMethods.includes(found.paymentMethod)) {
        throw new Error(
          "The original payment method is missing or unsupported. Check the sale record before processing a return."
        );
      }

      const historyResponse = await fetch(
        `/api/returns?q=${encodeURIComponent(found.receiptNumber)}`,
        { cache: "no-store" }
      );

      if (handleAccessDenied(historyResponse.status)) return;

      const history = await historyResponse.json();

      if (!historyResponse.ok) {
        throw new Error(
          history.error ?? "Could not retrieve the return history."
        );
      }

      const returnedQuantities: Record<string, number> =
        history.returnedQuantities ?? {};

      const items: ReturnableItem[] = found.items.map((item) => {
        const alreadyReturned = returnedQuantities[item.id] ?? 0;

        return {
          ...item,
          alreadyReturned,
          remainingQuantity: Math.max(0, item.quantity - alreadyReturned),
        };
      });

      setSale(found);
      setReturnableItems(items);
      setQuantities(
        Object.fromEntries(items.map((item) => [item.id, 0]))
      );
      setRestockChoices(
        Object.fromEntries(items.map((item) => [item.id, true]))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not find that receipt."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedItems = returnableItems.filter(
    (item) => (quantities[item.id] ?? 0) > 0
  );

  const refundTotal = selectedItems.reduce(
    (total, item) =>
      total + item.unitPricePesewas * (quantities[item.id] ?? 0),
    0
  );

  async function submitReturn() {
    if (!sale || selectedItems.length === 0) {
      setError("Select at least one item to return.");
      return;
    }

    setError("");
    setSuccess(null);

    const confirmed = window.confirm(
      `Record this return for ${formatMoney(refundTotal)} using ${formatPaymentMethod(sale.paymentMethod)}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber: sale.receiptNumber,
          refundMethod: sale.paymentMethod,
          reason,
          items: selectedItems.map((item) => ({
            saleItemId: item.id,
            quantity: quantities[item.id] ?? 0,
            restocked: restockChoices[item.id] ?? true,
          })),
        }),
      });

      if (handleAccessDenied(response.status)) return;

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not process return.");
      }

      setSuccess(result as ReturnResult);
      setQuantities(
        Object.fromEntries(returnableItems.map((item) => [item.id, 0]))
      );
      setReason("");

      const historyResponse = await fetch(
        `/api/returns?q=${encodeURIComponent(sale.receiptNumber)}`,
        { cache: "no-store" }
      );

      if (handleAccessDenied(historyResponse.status)) return;

      const history = await historyResponse.json();

      if (historyResponse.ok) {
        const returned: Record<string, number> =
          history.returnedQuantities ?? {};

        setReturnableItems((previous) =>
          previous.map((item) => {
            const alreadyReturned = returned[item.id] ?? 0;

            return {
              ...item,
              alreadyReturned,
              remainingQuantity: Math.max(
                0,
                item.quantity - alreadyReturned
              ),
            };
          })
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not process the return."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-medium text-gray-500">RETAIL POS</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Sales returns
        </h1>
        <p className="mt-2 text-gray-600">
          Find a receipt, select returned items and record the refund.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Find original receipt</h2>

        <form onSubmit={findSale} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
            placeholder="Enter full receipt number"
            required
            className="min-w-0 flex-1 rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-5 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Searching..." : "Find receipt"}
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-semibold text-green-900">
            Return recorded successfully
          </h2>
          <p className="mt-2 text-sm text-green-800">
            Return number: <strong>{success.returnNumber}</strong>
          </p>
          <p className="mt-1 text-sm text-green-800">
            Refund recorded: <strong>{formatMoney(success.refundAmountPesewas)}</strong>
          </p>
          <p className="mt-1 text-sm text-green-800">
            Original receipt: {success.receiptNumber}
          </p>
        </section>
      )}

      {sale && (
        <>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Receipt details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-sm text-gray-500">Receipt</p>
                <p className="font-medium">{sale.receiptNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date(sale.createdAt).toLocaleString("en-GH")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Original total</p>
                <p className="font-medium">{formatMoney(sale.totalPesewas)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Original payment</p>
                <p className="font-medium">
                  {formatPaymentMethod(sale.paymentMethod)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Select items to return</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Product</th>
                    <th className="py-3 pr-4">Sold</th>
                    <th className="py-3 pr-4">Returned</th>
                    <th className="py-3 pr-4">Available</th>
                    <th className="py-3 pr-4">Price</th>
                    <th className="py-3 pr-4">Return qty</th>
                    <th className="py-3">Restock?</th>
                  </tr>
                </thead>
                <tbody>
                  {returnableItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-gray-500">{item.sku}</p>
                      </td>
                      <td className="py-3 pr-4">{item.quantity}</td>
                      <td className="py-3 pr-4">{item.alreadyReturned}</td>
                      <td className="py-3 pr-4">{item.remainingQuantity}</td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {formatMoney(item.unitPricePesewas)}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          max={item.remainingQuantity}
                          step={1}
                          disabled={item.remainingQuantity === 0}
                          value={quantities[item.id] ?? 0}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            const safeQuantity =
                              Number.isFinite(parsed) && Number.isInteger(parsed)
                                ? Math.min(item.remainingQuantity, Math.max(0, parsed))
                                : 0;

                            setQuantities((previous) => ({
                              ...previous,
                              [item.id]: safeQuantity,
                            }));
                          }}
                          className="w-20 rounded-lg border px-2 py-1"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={restockChoices[item.id] ?? true}
                          onChange={(event) =>
                            setRestockChoices((previous) => ({
                              ...previous,
                              [item.id]: event.target.checked,
                            }))
                          }
                          aria-label={`Restock ${item.productName}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Refund details</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium">
                  Refund method
                </span>
                <div className="rounded-lg border bg-gray-50 px-3 py-2">
                  {formatPaymentMethod(sale.paymentMethod)}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Refund method must match the original payment method.
                </p>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Reason (optional)
                </span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Wrong item purchased"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col justify-between gap-4 border-t pt-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-gray-500">Total refund</p>
                <p className="text-2xl font-bold">{formatMoney(refundTotal)}</p>
              </div>

              <button
                type="button"
                onClick={submitReturn}
                disabled={submitting || selectedItems.length === 0}
                className="rounded-lg bg-gray-900 px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Record return"}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
