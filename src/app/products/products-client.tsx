
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import CsvImport from "./csv-import";
import { useToast } from "@/components/ui/toast-provider";
import ConfirmDialog from "@/components/ui/confirm-dialog";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string | null;
  unit: string;
  sellingPricePesewas: number;
  stockQuantity: number;
  isActive: boolean;
};

const emptyForm = {
  name: "",
  category: "",
  barcode: "",
  price: "",
  stock: "0",
};

function money(pesewas: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(pesewas / 100);
}

export default function ProductsPage() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productToDeactivate, setProductToDeactivate] =
    useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  async function loadProducts() {
    try {
      const response = await fetch("/api/products", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        window.location.replace("/checkout");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load products.");
      }

      setProducts(await response.json());
    } catch {
      showToast(
        "Could not load products. Check the server and try again.",
        "error"
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function startEditing(product: Product) {
    setEditing(product);

    setForm({
      name: product.name,
      category: product.category ?? "",
      price: (product.sellingPricePesewas / 100).toFixed(2),
      barcode: product.barcode ?? "",
      stock: String(product.stockQuantity),
    });

    document.getElementById("product-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function cancelEditing() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (
      !form.name.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(price * 100) ||
      (!editing && (!Number.isInteger(stock) || stock < 0))
    ) {
      showToast(
        "Check the product name, price and stock quantity.",
        "warning"
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        barcode: form.barcode.trim() || null,
        sellingPricePesewas: Math.round(price * 100),
        ...(!editing ? { stockQuantity: stock } : {}),
      };

      const response = await fetch("/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { id: editing.id, ...payload } : payload
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error ?? "Could not save product.", "error");
        return;
      }

      if (editing) {
        showToast(
          "Product updated successfully. Its SKU was preserved.",
          "success"
        );
      } else {
        showToast(
          `Product added successfully. Generated SKU: ${data.sku}`,
          "success"
        );
      }

      setForm(emptyForm);
      setEditing(null);

      await loadProducts();
    } catch {
      showToast(
        "Request failed. Check your server and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  function openDeactivateDialog(product: Product) {
    setProductToDeactivate(product);
    setConfirmOpen(true);
  }

  const closeDeactivateDialog = useCallback(() => {
    if (deactivating) return;

    setConfirmOpen(false);
    setProductToDeactivate(null);
  }, [deactivating]);

  async function deactivateProduct() {
    if (!productToDeactivate) return;

    setDeactivating(true);

    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productToDeactivate.id,
          isActive: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(
          data.error ?? "Could not deactivate product.",
          "error"
        );
        return;
      }

      if (editing?.id === productToDeactivate.id) {
        cancelEditing();
      }

      showToast(
        "Product deactivated. Its record was preserved.",
        "success"
      );

      setConfirmOpen(false);
      setProductToDeactivate(null);

      await loadProducts();
    } catch {
      showToast(
        "Request failed. Check your server and try again.",
        "error"
      );
    } finally {
      setDeactivating(false);
    }
  }

  const query = search.trim().toLowerCase();

  const filteredProducts = products.filter((product) =>
    [
      product.name,
      product.sku,
      product.category ?? "",
      product.barcode ?? "",
    ].some((value) => value.toLowerCase().includes(query))
  );

  const totalUnits = products.reduce(
    (total, product) => total + product.stockQuantity,
    0
  );

  const activeProducts = products.filter(
    (product) => product.isActive
  ).length;

  const inputClass =
    "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

  const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700";

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page heading */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
              Inventory management
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Products
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage your product catalogue, prices and stock.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              cancelEditing();
              document.getElementById("product-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            <span className="text-lg leading-none">+</span>
            Add product
          </button>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
                </svg>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Active products
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {loadingProducts ? "—" : activeProducts}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Products currently available in your catalogue
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                  <path d="M7 4v16M17 4v16" />
                </svg>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Total units in stock
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {loadingProducts ? "—" : totalUnits.toLocaleString("en-GH")}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Combined quantity across listed products
            </p>
          </div>
        </section>

        {/* Product form */}
        <section
          id="product-form"
          className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                {editing ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="m14 5 5 5M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" />
                  </svg>
                ) : (
                  <span className="text-xl">+</span>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? "Edit product" : "Add a new product"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editing
                    ? "Update product details without changing its SKU or stock."
                    : "Enter the product details. Your POS will generate its SKU automatically."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className={labelClass}>
                  Product name <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  maxLength={120}
                  autoComplete="off"
                  placeholder="e.g. Nido Milk 400g"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>
                  Category{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </span>
                <input
                  maxLength={80}
                  placeholder="e.g. Beverages"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>
                  Barcode{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </span>
                <input
                  maxLength={100}
                  autoComplete="off"
                  placeholder="Scan or enter barcode"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  className={inputClass}
                />
                <span className="mt-1.5 block text-xs text-slate-400">
                  Leave empty if the product has no barcode.
                </span>
              </label>

              <label className="block">
                <span className={labelClass}>
                  Selling price (GH₵){" "}
                  <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  className={inputClass}
                />
              </label>

              {!editing && (
                <label className="block">
                  <span className={labelClass}>
                    Opening stock <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    className={inputClass}
                  />
                  <span className="mt-1.5 block text-xs text-slate-400">
                    Number of units currently on hand.
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
              >
                {loading
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Save product"}
              </button>

              {editing && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}

              <p className="text-xs text-slate-400 sm:ml-auto">
                * Required fields
              </p>
            </div>
          </form>
        </section>

        {/* CSV import */}
        <CsvImport
          onImported={() => {
            void loadProducts();
          }}
        />

        {/* Product catalogue */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Product catalogue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {loadingProducts
                  ? "Loading catalogue..."
                  : `${filteredProducts.length} of ${products.length} products`}
              </p>
            </div>

            <label className="block w-full md:max-w-sm">
              <span className="sr-only">Search products</span>
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU or barcode..."
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </label>
          </div>

          {loadingProducts ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse items-center gap-4"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                    <div className="h-3 w-1/5 rounded bg-slate-100" />
                  </div>
                  <div className="h-8 w-20 rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
                </svg>
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                {query ? "No matching products" : "No products yet"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {query
                  ? "Try another name, SKU, category or barcode."
                  : "Add your first product to start building your catalogue."}
              </p>

              {query && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-4 text-sm font-semibold text-violet-600 hover:text-violet-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Product</th>
                    <th className="px-5 py-4 font-semibold">SKU</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Price
                    </th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Stock
                    </th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="transition hover:bg-violet-50/30"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {product.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {product.category || "Uncategorised"}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Barcode: {product.barcode || "Not assigned"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                          {product.sku}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-800">
                        {money(product.sellingPricePesewas)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex min-w-12 justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                            product.stockQuantity === 0
                              ? "bg-red-50 text-red-700"
                              : product.stockQuantity <= 5
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {product.stockQuantity}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(product)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeactivateDialog(product)}
                            disabled={!product.isActive}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Stock indicators: red = out of stock, amber = 5 units or fewer,
            green = more than 5 units.
          </div>
        </section>
      </div>

      {/* Deactivation confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate product?"
        description={
          productToDeactivate
            ? `Are you sure you want to stop selling "${productToDeactivate.name}"? Its sales history and existing records will be preserved.`
            : "Are you sure you want to deactivate this product?"
        }
        confirmLabel="Deactivate product"
        cancelLabel="Keep product"
        variant="danger"
        loading={deactivating}
        onConfirm={deactivateProduct}
        onClose={closeDeactivateDialog}
      />
    </main>
  );
}
