
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

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

export default function ReturnsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const idempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const submittingRef = useRef(false);

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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setConfirmOpen(false);
    idempotencyRef.current = null;

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

      showToast("Receipt found successfully.", "success");
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

  function requestReturn() {
    if (!sale || selectedItems.length === 0) {
      setError("Select at least one item to return.");
      return;
    }

    setError("");
    setConfirmOpen(true);
  }

  async function confirmReturn() {
    if (submittingRef.current || !sale || selectedItems.length === 0) return;

    setError("");

    const payload = {
      receiptNumber: sale.receiptNumber,
      refundMethod: sale.paymentMethod,
      reason: reason.trim(),
      items: selectedItems.map((item) => ({
        saleItemId: item.id,
        quantity: quantities[item.id] ?? 0,
        restocked: restockChoices[item.id] ?? true,
      })),
    };

    const fingerprint = JSON.stringify({
      ...payload,
      items: [...payload.items].sort((a, b) =>
        a.saleItemId.localeCompare(b.saleItemId)
      ),
    });

    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (idempotencyRef.current?.fingerprint !== fingerprint) {
        idempotencyRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }

      const idempotencyKey = idempotencyRef.current.key;

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (handleAccessDenied(response.status)) {
        setConfirmOpen(false);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not process return.");
      }

      idempotencyRef.current = null;

      setSuccess(result as ReturnResult);
      setConfirmOpen(false);
      setQuantities(
        Object.fromEntries(returnableItems.map((item) => [item.id, 0]))
      );
      setReason("");

      showToast("Return recorded successfully.", "success");

      try {
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
        } else {
          setError(
            "Return recorded, but the return history could not refresh. Search for the receipt again."
          );
        }
      } catch {
        setError(
          "Return recorded, but the return history could not refresh. Search for the receipt again."
        );
      }
    } catch (err) {
      setConfirmOpen(false);
      setError(
        err instanceof Error ? err.message : "Could not process the return."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const allItemsReturned =
    returnableItems.length > 0 &&
    returnableItems.every((item) => item.remainingQuantity === 0);

  return (
    <main className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
            Sales management
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Sales returns
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Find an original receipt, select returned items and record the
            refund.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M3 10h11a5 5 0 0 1 0 10H9" strokeLinecap="round" />
              <path d="m7 6-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 4h5v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Find original receipt
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the complete receipt number to retrieve the sale.
            </p>
          </div>
        </div>

        <form
          onSubmit={findSale}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
            placeholder="e.g. POS-20261026-59E75D6A"
            required
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {loading ? "Searching..." : "Find receipt"}
          </button>
        </form>
      </section>

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

      {success && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="min-w-0">
              <h2 className="font-semibold text-emerald-900">
                Return recorded successfully
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                The return has been saved.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 border-t border-emerald-200 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-emerald-700">Return number</p>
              <p className="mt-1 break-all text-sm font-semibold text-emerald-950">
                {success.returnNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-700">Refund recorded</p>
              <p className="mt-1 text-lg font-bold text-emerald-950">
                {formatMoney(success.refundAmountPesewas)}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-700">Original receipt</p>
              <p className="mt-1 break-all text-sm font-semibold text-emerald-950">
                {success.receiptNumber}
              </p>
            </div>
          </div>
        </section>
      )}

      {sale && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Original transaction
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Receipt details
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">
                {sale.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Receipt number</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                  {sale.receiptNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(sale.createdAt).toLocaleString("en-GH")}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Original total</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatMoney(sale.totalPesewas)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Original payment</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPaymentMethod(sale.paymentMethod)}
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Select items to return
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the quantities being returned.
                  </p>
                </div>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {selectedItems.length} selected
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Sold</th>
                    <th className="px-4 py-3 font-semibold">Returned</th>
                    <th className="px-4 py-3 font-semibold">Available</th>
                    <th className="px-4 py-3 font-semibold">Unit price</th>
                    <th className="px-4 py-3 font-semibold">Return qty</th>
                    <th className="px-5 py-3 font-semibold">Restock</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {returnableItems.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.productName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          SKU: {item.sku}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {item.alreadyReturned}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.remainingQuantity > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.remainingQuantity}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">
                        {formatMoney(item.unitPricePesewas)}
                      </td>
                      <td className="px-4 py-4">
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
                              Number.isFinite(parsed) &&
                              Number.isInteger(parsed)
                                ? Math.min(
                                    item.remainingQuantity,
                                    Math.max(0, parsed)
                                  )
                                : 0;

                            setQuantities((previous) => ({
                              ...previous,
                              [item.id]: safeQuantity,
                            }));
                          }}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
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
                            className="h-4 w-4 rounded border-slate-300 accent-violet-600 focus:ring-violet-500"
                          />
                          Yes
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {allItemsReturned && (
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                All items on this receipt have already been returned.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="font-bold text-slate-900">Refund details</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review the refund method and provide a reason if necessary.
              </p>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Refund method
                </span>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                  {formatPaymentMethod(sale.paymentMethod)}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Refund method must match the original payment method.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Reason <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  placeholder="e.g. Wrong item purchased"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total refund
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {formatMoney(refundTotal)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedItems.length} product line
                  {selectedItems.length === 1 ? "" : "s"} selected
                </p>
              </div>

              <button
                type="button"
                onClick={requestReturn}
                disabled={
                  submitting ||
                  selectedItems.length === 0 ||
                  allItemsReturned
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Record return
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm sales return"
        description={
          sale
            ? `Record this return for ${formatMoney(refundTotal)} using ${formatPaymentMethod(sale.paymentMethod)}? This action cannot be undone.`
            : "Are you sure you want to record this return?"
        }
        confirmLabel="Confirm return"
        cancelLabel="Go back"
        variant="danger"
        loading={submitting}
        onConfirm={confirmReturn}
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
      />
    </main>
  );
}
