
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

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

type BusinessSettings = {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptFooter: string | null;
};

type PaymentMethod = "cash" | "mobile_money" | "card";

type CheckoutResult = {
  sale: {
    id: string;
    receiptNumber: string;
    subtotalPesewas: number;
    totalPesewas: number;
    amountPaidPesewas: number;
    changePesewas: number;
    paymentMethod: PaymentMethod;
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

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  card: "Card",
};

export default function CheckoutPage() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>({
      businessName: "My Shop",
      address: null,
      phone: null,
      email: null,
      receiptFooter: null,
    });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] =
    useState<CheckoutResult["sale"] | null>(null);
  const [quantityInputs, setQuantityInputs] =
    useState<Record<string, string>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  const idempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const checkoutInProgressRef = useRef(false);

  const loadProducts = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      try {
        await loadProducts();
      } catch {
        if (!cancelled) {
          showToast("Could not load products. Please refresh the page.", "error");
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    }

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [loadProducts, showToast]);

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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(
      (product) =>
        product.isActive &&
        product.stockQuantity > 0 &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
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
    setReceipt(null);

    const existing = cart.find(
      (item) => item.product.id === product.id
    );

    if (existing && existing.quantity >= product.stockQuantity) {
      showToast(
        `Maximum available stock for ${product.name} reached.`,
        "warning"
      );
      return;
    }

    setCart((current) => {
      const currentItem = current.find(
        (item) => item.product.id === product.id
      );

      if (currentItem) {
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
      showToast("No product found with that barcode.", "error");
      return;
    }

    if (!product.isActive || product.stockQuantity <= 0) {
      showToast(`${product.name} is inactive or out of stock.`, "warning");
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
    if (checkoutInProgressRef.current) return;

    setReceipt(null);

    if (cart.length === 0) {
      showToast("Add at least one product to the cart.", "warning");
      return;
    }

    if (!Number.isFinite(paidPesewas) || paidPesewas < 0) {
      showToast("Enter a valid payment amount.", "error");
      return;
    }

    if (paymentMethod === "cash" && paidPesewas < total) {
      showToast("The cash received is less than the total.", "error");
      return;
    }

    if (paymentMethod !== "cash" && paidPesewas !== total) {
      showToast(
        "For Mobile Money or card, enter the exact total.",
        "error"
      );
      return;
    }

    const checkoutItems = cart
      .map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId));

    const fingerprint = JSON.stringify({
      items: checkoutItems,
      paymentMethod,
      amountPaidPesewas: paidPesewas,
    });

    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    const idempotencyKey = idempotencyRef.current.key;

    checkoutInProgressRef.current = true;
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: checkoutItems,
          paymentMethod,
          amountPaidPesewas: paidPesewas,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      idempotencyRef.current = null;

      setReceipt(data.sale);
      setCart([]);
      setAmountPaid("");
      setQuantityInputs({});

      showToast("Sale completed successfully.", "success");

      // The sale is already confirmed. A refresh failure must not
      // make the cashier think the sale itself failed.
      try {
        await loadProducts();
      } catch {
        showToast(
          "Sale completed, but product stock could not refresh. Please refresh the page.",
          "warning"
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not complete the sale.",
        "error"
      );
    } finally {
      checkoutInProgressRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-6 text-[#172033] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#6d4aff]">
                {businessSettings.businessName}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Checkout
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Select products, collect payment and complete a sale.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-xl border border-[#e9e7f2] bg-white px-3 py-2 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Point of sale
            </div>
          </div>
        </header>

        {receipt && (
          <section className="print-receipt mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="receipt-content mx-auto max-w-md">
              <div className="no-print mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                  ✓
                </span>
                Sale completed successfully
              </div>

              <h2 className="text-center text-2xl font-bold">
                {businessSettings.businessName}
              </h2>

              {businessSettings.address && (
                <p className="text-center text-sm text-gray-600">
                  {businessSettings.address}
                </p>
              )}

              {businessSettings.phone && (
                <p className="text-center text-sm text-gray-600">
                  Tel: {businessSettings.phone}
                </p>
              )}

              {businessSettings.email && (
                <p className="text-center text-sm text-gray-600">
                  {businessSettings.email}
                </p>
              )}

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
                  <span>{paymentLabels[receipt.paymentMethod]}</span>
                </div>
              </div>

              <p className="mt-6 text-center text-sm">
                {businessSettings.receiptFooter ||
                  "Thank you for shopping with us!"}
              </p>

              <div className="no-print mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl bg-[#6d4aff] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5836e6]"
                >
                  Print receipt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  New sale
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="min-w-0 rounded-2xl border border-[#e9e7f2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Products</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search for a product or scan its barcode.
                </p>
              </div>
              <span className="rounded-full bg-[#f1edff] px-3 py-1 text-xs font-semibold text-[#6d4aff]">
                {filteredProducts.length} available
              </span>
            </div>

            <label
              className="mt-5 block text-sm font-medium text-slate-700"
              htmlFor="search"
            >
              Product search
            </label>

            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search name, SKU or scan barcode..."
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-[#fbfbfd] py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
              />
            </div>

            {productsLoading ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-xl border border-slate-100 p-4"
                  >
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-slate-100" />
                    <div className="mt-5 h-5 w-1/2 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#b9aaff] hover:bg-[#faf9ff] focus:outline-none focus:ring-4 focus:ring-[#6d4aff]/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          SKU: {product.sku}
                        </span>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1edff] text-lg font-medium text-[#6d4aff] transition group-hover:bg-[#6d4aff] group-hover:text-white">
                        +
                      </span>
                    </div>

                    {product.barcode && (
                      <span className="mt-2 block truncate text-xs text-slate-500">
                        Barcode: {product.barcode}
                      </span>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-2">
                      <span className="font-bold text-[#6d4aff]">
                        {money(product.sellingPricePesewas)}
                      </span>
                      <span className="text-xs text-slate-500">
                        Stock: {product.stockQuantity}
                      </span>
                    </div>
                  </button>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                    <p className="font-medium text-slate-700">
                      No available products found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try another search or check your product stock.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-2xl border border-[#e9e7f2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Current sale</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review items and collect payment.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f1edff] text-[#6d4aff]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="h-6 w-6"
                  >
                    <path d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
                    <circle cx="10" cy="20" r="1" />
                    <circle cx="18" cy="20" r="1" />
                  </svg>
                </div>
                <p className="mt-3 font-medium text-slate-700">
                  Your cart is empty
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Select a product to begin a sale.
                </p>
              </div>
            ) : (
              <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="border-b border-slate-100 pb-4 last:border-0"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {item.product.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {money(item.product.sellingPricePesewas)} each
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-slate-800">
                        {money(
                          item.product.sellingPricePesewas * item.quantity
                        )}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label
                        className="text-xs font-medium text-slate-500"
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

                          if (
                            nextQuantity > item.product.stockQuantity
                          ) {
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
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#9b86ff] focus:ring-2 focus:ring-[#6d4aff]/10"
                      />
                      <span className="text-xs text-slate-400">
                        Maximum: {item.product.stockQuantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Total</span>
                <span className="text-2xl font-bold tracking-tight text-[#6d4aff]">
                  {money(total)}
                </span>
              </div>

              <label
                htmlFor="paymentMethod"
                className="mt-5 block text-sm font-medium text-slate-700"
              >
                Payment method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Card</option>
              </select>

              <label
                htmlFor="amountPaid"
                className="mt-4 block text-sm font-medium text-slate-700"
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
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none transition focus:border-[#9b86ff] focus:ring-4 focus:ring-[#6d4aff]/10"
              />

              {paymentMethod === "cash" && (
                <div className="mt-4 rounded-xl bg-[#f7f8fc] p-4">
                  {balanceDue > 0 ? (
                    <div className="flex justify-between gap-3 text-sm text-rose-600">
                      <span>Balance remaining</span>
                      <strong>{money(balanceDue)}</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-3 text-sm text-emerald-700">
                      <span>Change due</span>
                      <strong>{money(Math.max(0, change))}</strong>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={completeSale}
                disabled={loading || cart.length === 0 || productsLoading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d4aff] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5836e6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {loading ? "Processing sale..." : "Complete sale"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                Review the total and payment amount before completing the sale.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
