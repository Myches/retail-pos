
"use client";

import { FormEvent, useEffect, useState } from "react";
import CsvImport from "./csv-import";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  async function loadProducts() {
    try {
      const response = await fetch("/api/products");

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (response.status === 403) {
        window.location.replace("/checkout");
        return;
      }

      if (!response.ok) throw new Error();

      setProducts(await response.json());
    } catch {
      setMessage("Could not load products. Check the server and try again.");
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
    setMessage("");
  }

  function cancelEditing() {
    setEditing(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (
      !form.name.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(price * 100) ||
      (!editing && (!Number.isInteger(stock) || stock < 0))
    ) {
      setMessage("Check the product name, price and stock quantity.");
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
        setMessage(data.error ?? "Could not save product.");
        return;
      }

      if (editing) {
        setMessage("Product updated successfully. Its SKU was preserved.");
      } else {
        setMessage(
          `Product added successfully. Generated SKU: ${data.sku}`
        );
      }

      setForm(emptyForm);
      setEditing(null);
      await loadProducts();
    } catch {
      setMessage("Request failed. Check your server and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateProduct(product: Product) {
    if (!window.confirm(`Stop selling "${product.name}"?`)) return;

    setMessage("");

    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, isActive: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not deactivate product.");
        return;
      }

      if (editing?.id === product.id) cancelEditing();

      setMessage("Product deactivated. Its record was preserved.");
      await loadProducts();
    } catch {
      setMessage("Request failed. Check your server and try again.");
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
              Inventory management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Products
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Manage your catalogue, prices and available stock in one place.
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            + Add product
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                📦
              </div>
              <div>
                <p className="text-sm text-slate-500">Active products</p>
                <p className="mt-1 text-2xl font-bold">
                  {loadingProducts ? "—" : products.length}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Products currently available in your catalogue
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                🧮
              </div>
              <div>
                <p className="text-sm text-slate-500">Total units in stock</p>
                <p className="mt-1 text-2xl font-bold">
                  {loadingProducts ? "—" : totalUnits.toLocaleString("en-GH")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Combined quantity across listed products
            </p>
          </div>
        </section>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
          >
            {message}
          </div>
        )}

        <section
          id="product-form"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <h2 className="text-xl font-bold">
              {editing ? "Edit product" : "Add a new product"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editing
                ? "Update product details without changing its SKU or stock."
                : "Enter the essentials. Your POS will generate the SKU automatically."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Product name <span className="text-red-600">*</span>
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
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Category <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  maxLength={80}
                  placeholder="e.g. Beverages"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
  <span className="mb-2 block text-sm font-semibold text-slate-700">
    Barcode <span className="font-normal text-slate-400">(optional)</span>
  </span>
  <input
    maxLength={100}
    autoComplete="off"
    placeholder="Scan or enter product barcode"
    value={form.barcode}
    onChange={(e) =>
      setForm({ ...form, barcode: e.target.value })
    }
    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
  />
  <span className="mt-1.5 block text-xs text-slate-500">
    You can leave this empty if the product has no barcode.
  </span>
</label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Selling price (GH₵) <span className="text-red-600">*</span>
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
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              {!editing && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Opening stock <span className="text-red-600">*</span>
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
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="mt-1.5 block text-xs text-slate-500">
                    Enter the number of units currently on hand.
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
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
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}

              <p className="text-xs text-slate-500 sm:ml-auto">
                * Required fields
              </p>
            </div>
          </form>
        </section>

        <CsvImport onImported={loadProducts} />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Product catalogue</h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredProducts.length} of {products.length} products
              </p>
            </div>

            <label className="block w-full md:max-w-sm">
              <span className="sr-only">Search products</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, SKU, barcode..."
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </label>
          </div>

          {loadingProducts ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">📦</div>
              <h3 className="mt-3 font-semibold">No products found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try a different search or add a new product.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Product</th>
                    <th className="px-5 py-4 font-semibold">SKU</th>
                    <th className="px-5 py-4 text-right font-semibold">Price</th>
                    <th className="px-5 py-4 text-right font-semibold">Stock</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                       <div className="font-semibold text-slate-900">
  {product.name}
</div>
<div className="mt-1 text-xs text-slate-500">
  {product.category || "Uncategorised"}
</div>
<div className="mt-1 text-xs text-slate-500">
  Barcode: {product.barcode || "Not assigned"}
</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums">
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
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deactivateProduct(product)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-50"
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
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Stock labels: red = out of stock, amber = 5 units or fewer, green = more than 5 units.
          </div>
        </section>
      </div>
    </main>
  );
}
