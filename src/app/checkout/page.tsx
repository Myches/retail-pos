
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LogoutButton from "@/components/logout-button";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPricePesewas: number;
  stockQuantity: number;
  isActive: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type CheckoutResult = {
  sale: {
    id: string;
    receiptNumber: string;
    subtotalPesewas: number;
    totalPesewas: number;
    amountPaidPesewas: number;
    changePesewas: number;
    paymentMethod: "cash" | "mobile_money" | "card";
    createdAt: string;
    staff: {
      username: string;
    } | null;
    items: Array<{
      id: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPricePesewas: number;
      lineTotalPesewas: number;
    }>;
  };
};

const money = (pesewas: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(pesewas / 100);

export default function CheckoutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] =
    useState<CheckoutResult["sale"] | null>(null);
  const [quantityInputs, setQuantityInputs] =
    useState<Record<string, string>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  async function loadProducts() {
    const response = await fetch("/api/products", {
      cache: "no-store",
    });

    if (response.status === 401) {
      window.location.replace("/login");
      return;
    }

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    const data = await response.json();
    const productList = data.value ?? data.products ?? data;

    setProducts(
      productList.map((product: Product) => ({
        ...product,
        barcode: product.barcode ?? null,
      }))
    );
  }

  useEffect(() => {
    loadProducts().catch(() => {
      setMessage("Could not load products. Please refresh the page.");
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(
      (product) =>
        product.isActive &&
        product.stockQuantity > 0 &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          (product.barcode ?? "").toLowerCase().includes(term))
    );
  }, [products, search]);

  const total = cart.reduce(
    (sum, item) =>
      sum + item.product.sellingPricePesewas * item.quantity,
    0
  );

  const paidPesewas = Math.round(Number(amountPaid || 0) * 100);
  const change = paymentMethod === "cash" ? paidPesewas - total : 0;
  const balanceDue = Math.max(0, total - paidPesewas);

  function addProduct(product: Product) {
    setMessage("");
    setReceipt(null);

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setMessage(`Maximum available stock for ${product.name} reached.`);
          return current;
        }

        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const term = search.trim().toLowerCase();

    if (!term) return;

    const product = products.find(
      (item) => item.barcode?.trim().toLowerCase() === term
    );

    if (!product) {
      setMessage("No product found with that barcode.");
      return;
    }

    if (!product.isActive || product.stockQuantity <= 0) {
      setMessage(`${product.name} is inactive or out of stock.`);
      return;
    }

    addProduct(product);
    setSearch("");
    searchInputRef.current?.focus();
  }

  function changeQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.min(
                  Math.max(0, quantity),
                  item.product.stockQuantity
                ),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function completeSale() {
    setMessage("");
    setReceipt(null);

    if (cart.length === 0) {
      setMessage("Add at least one product to the cart.");
      return;
    }

    if (!Number.isFinite(paidPesewas) || paidPesewas < 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }

    if (paymentMethod === "cash" && paidPesewas < total) {
      setMessage("The cash received is less than the total.");
      return;
    }

    if (paymentMethod !== "cash" && paidPesewas !== total) {
      setMessage("For Mobile Money or card, enter the exact total.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          paymentMethod,
          amountPaidPesewas: paidPesewas,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      setReceipt(data.sale);
      setCart([]);
      setAmountPaid("");
      setQuantityInputs({});
      await loadProducts();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not complete the sale."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Retail POS
            </p>
            <h1 className="mt-1 text-3xl font-bold">Checkout</h1>
            <p className="mt-2 text-slate-600">
              Select products, collect payment and complete a sale.
            </p>
          </div>
          <LogoutButton />
        </header>

        {message && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
          >
            {message}
          </div>
        )}

        {receipt && (
          <section className="print-receipt mb-6 rounded-xl border border-green-200 bg-white p-5 shadow-sm">
            <div className="receipt-content mx-auto max-w-md">
              <h2 className="text-center text-2xl font-bold">
                Sale completed successfully
              </h2>

              <p className="mt-1 text-center text-sm text-gray-600">
                RETAIL POS
              </p>

              <div className="my-4 border-t border-dashed border-gray-400" />

              <p className="text-sm">
                <strong>Receipt:</strong> {receipt.receiptNumber}
              </p>
              <p className="text-sm">
                <strong>Date:</strong>{" "}
                {new Date(receipt.createdAt).toLocaleString("en-GH")}
              </p>
              <p className="text-sm">
                <strong>Cashier:</strong>{" "}
                {receipt.staff?.username ?? "Staff"}
              </p>

              <div className="my-4 border-t border-dashed border-gray-400" />

              <div className="space-y-3">
                {receipt.items.map((item) => (
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
                  <span>{money(receipt.subtotalPesewas)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{money(receipt.totalPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount paid</span>
                  <span>{money(receipt.amountPaidPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{money(receipt.changePesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment method</span>
                  <span className="capitalize">
                    {receipt.paymentMethod.replace("_", " ")}
                  </span>
                </div>
              </div>

              <p className="mt-6 text-center text-sm">
                Thank you for shopping with us!
              </p>

              <div className="no-print mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white"
                >
                  Print receipt
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Products</h2>

            <label
              className="mt-4 block text-sm font-medium"
              htmlFor="search"
            >
              Search by name or scan barcode
            </label>

            <input
              ref={searchInputRef}
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Type product name or scan barcode..."
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-blue-500 hover:bg-blue-50"
                >
                  <span className="block font-semibold">
                    {product.name}
                  </span>

                  {product.barcode && (
                    <span className="mt-1 block text-sm text-slate-500">
                      Barcode: {product.barcode}
                    </span>
                  )}

                  <span className="mt-2 block font-bold text-blue-700">
                    {money(product.sellingPricePesewas)}
                  </span>

                  <span className="mt-1 block text-sm text-slate-500">
                    Stock: {product.stockQuantity}
                  </span>
                </button>
              ))}

              {filteredProducts.length === 0 && (
                <p className="text-sm text-slate-500">
                  No available products match your search.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Current sale</h2>

            {cart.length === 0 ? (
              <p className="mt-4 text-slate-500">
                Your cart is empty. Select a product to begin.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="border-b border-slate-100 pb-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.product.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {money(item.product.sellingPricePesewas)} each
                        </p>
                      </div>

                      <p className="font-semibold">
                        {money(
                          item.product.sellingPricePesewas * item.quantity
                        )}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <label
                        className="text-sm text-slate-600"
                        htmlFor={`qty-${item.product.id}`}
                      >
                        Quantity
                      </label>

                      <input
                        id={`qty-${item.product.id}`}
                        type="number"
                        min="0"
                        max={item.product.stockQuantity}
                        value={
                          quantityInputs[item.product.id] ??
                          String(item.quantity)
                        }
                        onChange={(event) => {
                          const value = event.target.value;

                          if (value === "") {
                            setQuantityInputs((current) => ({
                              ...current,
                              [item.product.id]: "",
                            }));
                            return;
                          }

                          if (!/^\d+$/.test(value)) return;

                          const nextQuantity = Number(value);

                          if (nextQuantity > item.product.stockQuantity) {
                            return;
                          }

                          setQuantityInputs((current) => ({
                            ...current,
                            [item.product.id]: value,
                          }));

                          changeQuantity(item.product.id, nextQuantity);
                        }}
                        onBlur={() => {
                          setQuantityInputs((current) => {
                            const next = { ...current };
                            delete next[item.product.id];
                            return next;
                          });
                        }}
                        className="w-24 rounded-lg border p-2"
                      />

                      <span className="text-xs text-slate-500">
                        Max {item.product.stockQuantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between text-xl font-bold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>

              <label
                htmlFor="paymentMethod"
                className="mt-5 block text-sm font-medium"
              >
                Payment method
              </label>

              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
              </select>

              <label
                htmlFor="amountPaid"
                className="mt-4 block text-sm font-medium"
              >
                Amount received (GH₵)
              </label>

              <input
                id="amountPaid"
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                placeholder="e.g. 20.00"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />

              {paymentMethod === "cash" && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                  {balanceDue > 0 ? (
                    <div className="flex justify-between text-red-700">
                      <span>Balance remaining</span>
                      <strong>{money(balanceDue)}</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between text-green-700">
                      <span>Change due</span>
                      <strong>{money(Math.max(0, change))}</strong>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={completeSale}
                disabled={loading || cart.length === 0}
                className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Processing sale..." : "Complete sale"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
