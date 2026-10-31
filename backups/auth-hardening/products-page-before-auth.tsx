
"use client";

import { FormEvent, useEffect, useState } from "react";

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
  sku: "",
  category: "",
  price: "",
  stock: "0",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error();
      setProducts(await response.json());
    } catch {
      setMessage("Could not load products. Check the server.");
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function startEditing(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category ?? "",
      price: (product.sellingPricePesewas / 100).toFixed(2),
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
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(price * 100) ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setMessage("Enter a valid price and whole-number stock quantity.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category.trim() || null,
        sellingPricePesewas: Math.round(price * 100),
        ...(editing ? {} : { stockQuantity: stock }),
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

      setMessage(editing ? "Product updated." : "Product added.");
      setForm(emptyForm);
      setEditing(null);
      await loadProducts();
    } catch {
      setMessage("Request failed. Check your server.");
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
      setMessage("Request failed. Check your server.");
    }
  }

  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      (product.category ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <main style={{ maxWidth: 1000, margin: "32px auto", padding: 20 }}>
      <h1>Retail POS — Products</h1>
      <p>Add, find and edit your product catalogue.</p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 450,
          marginBottom: 28,
        }}
      >
        <h2>{editing ? "Edit product" : "Add a product"}</h2>

        <label>
          Product name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          SKU (unique product code)
          <input
            required
            maxLength={60}
            value={form.sku}
            onChange={(e) =>
              setForm({ ...form, sku: e.target.value })
            }
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Category
          <input
            maxLength={80}
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Selling price (GH₵)
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: e.target.value })
            }
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        {!editing && (
          <label>
            Opening stock (whole units)
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) =>
                setForm({ ...form, stock: e.target.value })
              }
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : editing
              ? "Save changes"
              : "Add product"}
        </button>

        {editing && (
          <button type="button" onClick={cancelEditing}>
            Cancel editing
          </button>
        )}
      </form>

      {message && <p role="status">{message}</p>}

      <h2>Products ({products.length})</h2>

      <label>
        Search by name, SKU or category
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. Milo or MILO-400"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 450,
            padding: 10,
            marginBottom: 16,
          }}
        />
      </label>

      {filteredProducts.length === 0 ? (
        <p>No matching products found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">SKU</th>
                <th align="right">Price (GH₵)</th>
                <th align="right">Stock</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td align="right">
                    {(product.sellingPricePesewas / 100).toFixed(2)}
                  </td>
                  <td align="right">{product.stockQuantity}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => void deactivateProduct(product)}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
