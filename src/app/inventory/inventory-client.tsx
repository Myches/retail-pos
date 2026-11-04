
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

type Product = {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
};

type Movement = {
  id: string;
  type: string;
  quantityChange: number;
  note: string | null;
  createdAt: string;
  product: {
    name: string;
    sku: string;
  };
};

const movementLabels: Record<string, string> = {
  received: "Stock received",
  returned: "Sale return",
  damaged: "Damaged goods",
  adjustment_in: "Stock increase",
  adjustment_out: "Stock decrease",
};

const movementStyles: Record<string, string> = {
  received: "bg-emerald-50 text-emerald-700",
  returned: "bg-blue-50 text-blue-700",
  damaged: "bg-red-50 text-red-700",
  adjustment_in: "bg-violet-50 text-violet-700",
  adjustment_out: "bg-amber-50 text-amber-700",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InventoryPage() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [productId, setProductId] = useState("");
  const [type, setType] = useState("received");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    const [productResponse, movementResponse] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/inventory", { cache: "no-store" }),
    ]);

    if (
      productResponse.status === 401 ||
      movementResponse.status === 401
    ) {
      window.location.replace("/login");
      return;
    }

    if (
      productResponse.status === 403 ||
      movementResponse.status === 403
    ) {
      window.location.replace("/checkout");
      return;
    }

    if (!productResponse.ok || !movementResponse.ok) {
      throw new Error("Could not load inventory.");
    }

    const productData: Product[] = await productResponse.json();
    const movementData: Movement[] = await movementResponse.json();

    setProducts(productData);
    setMovements(movementData);

    setProductId((currentId) =>
      productData.some((product) => product.id === currentId)
        ? currentId
        : productData[0]?.id ?? ""
    );
  }, []);

  useEffect(() => {
    async function initialise() {
      try {
        await loadData();
      } catch {
        showToast(
          "Could not load inventory. Check the server and try again.",
          "error"
        );
      } finally {
        setLoadingData(false);
      }
    }

    void initialise();
  }, [loadData, showToast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(quantity);

    if (!productId || !Number.isSafeInteger(amount) || amount <= 0) {
      showToast(
        "Choose a product and enter a positive whole quantity.",
        "warning"
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          type,
          quantity: amount,
          note: note.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(
          data.error ?? "Could not record stock movement.",
          "error"
        );
        return;
      }

      showToast("Stock movement recorded successfully.", "success");

      setQuantity("1");
      setNote("");

      await loadData();
    } catch {
      showToast(
        "Request failed. Check your server and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  const totalUnits = products.reduce(
    (total, product) => total + product.stockQuantity,
    0
  );

  const outOfStock = products.filter(
    (product) => product.stockQuantity === 0
  ).length;

  const lowStock = products.filter(
    (product) =>
      product.stockQuantity > 0 && product.stockQuantity <= 5
  ).length;

  const inputClass =
    "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

  const labelClass = "block text-sm font-semibold text-slate-700";

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page heading */}
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            Stock control
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Inventory
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Track stock levels and record deliveries, returns and adjustments.
          </p>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                  <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Products tracked</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {loadingData ? "—" : products.length}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Products in your inventory
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                  <path d="M7 4v16M17 4v16" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total units</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {loadingData ? "—" : totalUnits.toLocaleString("en-GH")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Combined quantity across products
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                  <path d="M12 9v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Stock alerts</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {loadingData ? "—" : lowStock + outOfStock}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {loadingData
                ? "Checking stock levels..."
                : `${lowStock} low stock · ${outOfStock} out of stock`}
            </p>
          </div>
        </section>

        {/* Stock movement form */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Record stock movement
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update a product's quantity and keep a movement record.
                </p>
              </div>
            </div>
          </div>

          {loadingData ? (
            <div className="animate-pulse space-y-4 p-6">
              <div className="h-12 rounded-xl bg-slate-100" />
              <div className="h-12 rounded-xl bg-slate-100" />
              <div className="h-12 rounded-xl bg-slate-100" />
            </div>
          ) : products.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl">📦</div>
              <h3 className="mt-3 font-semibold text-slate-900">
                No products available
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add an active product before recording stock movements.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>
                  Product
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku}) — Stock: {product.stockQuantity}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Movement type
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="received">Stock received</option>
                    <option value="returned">Sale return / stock returned</option>
                    <option value="damaged">Damaged goods</option>
                    <option value="adjustment_in">Stock correction: increase</option>
                    <option value="adjustment_out">Stock correction: decrease</option>
                  </select>
                </label>

                <label className={labelClass}>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Note / reason
                  <input
                    maxLength={250}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Delivery from supplier"
                    className={inputClass}
                  />
                  <span className="mt-1.5 block text-xs font-normal text-slate-400">
                    Optional. Add a reason for this movement.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                <button
                  disabled={loading || !productId}
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                >
                  {loading ? "Recording..." : "Record stock movement"}
                </button>

                <p className="text-xs text-slate-400">
                  Stock changes are recorded in the movement history.
                </p>
              </div>
            </form>
          )}
        </section>

        {/* Current stock */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">
              Current stock
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current quantity available for each product.
            </p>
          </div>

          {loadingData ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading stock levels...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No products to display.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Product</th>
                    <th className="px-5 py-4 font-semibold">SKU</th>
                    <th className="px-5 py-4 text-right font-semibold">Quantity</th>
                    <th className="px-5 py-4 text-right font-semibold">Stock status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id} className="transition hover:bg-violet-50/30">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {product.name}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums">
                        {product.stockQuantity}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            product.stockQuantity === 0
                              ? "bg-red-50 text-red-700"
                              : product.stockQuantity <= 5
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {product.stockQuantity === 0
                            ? "Out of stock"
                            : product.stockQuantity <= 5
                              ? "Low stock"
                              : "In stock"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent movements */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">
              Recent stock movements
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A record of recent changes made to your inventory.
            </p>
          </div>

          {loadingData ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading movement history...
            </div>
          ) : movements.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <h3 className="font-semibold text-slate-900">
                No stock movements yet
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Recorded deliveries, returns and adjustments will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Date</th>
                    <th className="px-5 py-4 font-semibold">Product</th>
                    <th className="px-5 py-4 font-semibold">Movement</th>
                    <th className="px-5 py-4 text-right font-semibold">Change</th>
                    <th className="px-5 py-4 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDate(movement.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {movement.product.name}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-400">
                          {movement.product.sku}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            movementStyles[movement.type] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {movementLabels[movement.type] ?? movement.type}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-bold tabular-nums ${
                          movement.quantityChange > 0
                            ? "text-emerald-600"
                            : movement.quantityChange < 0
                              ? "text-red-600"
                              : "text-slate-500"
                        }`}
                      >
                        {movement.quantityChange > 0 ? "+" : ""}
                        {movement.quantityChange}
                      </td>
                      <td className="max-w-[220px] px-5 py-4 text-slate-500">
                        {movement.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
