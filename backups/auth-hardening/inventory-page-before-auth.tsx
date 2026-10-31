"use client";

import { FormEvent, useEffect, useState } from "react";

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

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("received");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    const [productResponse, movementResponse] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/inventory"),
    ]);

    if (!productResponse.ok || !movementResponse.ok) {
      throw new Error("Could not load inventory.");
    }

    const productData: Product[] = await productResponse.json();
    const movementData: Movement[] = await movementResponse.json();

    setProducts(productData);
    setMovements(movementData);

    if (
      productData.length > 0 &&
      !productData.some((product) => product.id === productId)
    ) {
      setProductId(productData[0].id);
    }
  }

 
 useEffect(() => {
  let cancelled = false;

  async function initialise() {
    try {
      const [productResponse, movementResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/inventory"),
      ]);

      if (!productResponse.ok || !movementResponse.ok) {
        throw new Error("Could not load inventory.");
      }

      const productData: Product[] = await productResponse.json();
      const movementData: Movement[] = await movementResponse.json();

      if (!cancelled) {
        setProducts(productData);
        setMovements(movementData);

        if (productData.length > 0) {
          setProductId((currentId) =>
            productData.some((product) => product.id === currentId)
              ? currentId
              : productData[0].id
          );
        }
      }
    } catch {
      if (!cancelled) {
        setMessage("Could not load inventory. Check the API responses.");
      }
    }
  }

  void initialise();

  return () => {
    cancelled = true;
  };
}, []); 

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const amount = Number(quantity);

    if (!productId || !Number.isSafeInteger(amount) || amount <= 0) {
      setMessage("Choose a product and enter a positive whole quantity.");
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
        setMessage(data.error ?? "Could not record movement.");
        return;
      }

      setMessage("Stock movement recorded successfully.");
      setQuantity("1");
      setNote("");

      await loadData();
    } catch {
      setMessage("Request failed. Check your server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "32px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Inventory Management</h1>

      <p>
        Receive stock and record returns, damage and stock adjustments.
      </p>

      {products.length === 0 ? (
        <p>Add an active product before recording stock movements.</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 12,
            maxWidth: 450,
            marginBottom: 32,
          }}
        >
          <label>
            Product

            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 5,
              }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) — Stock:{" "}
                  {product.stockQuantity}
                </option>
              ))}
            </select>
          </label>

          <label>
            Movement type

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 5,
              }}
            >
              <option value="received">Stock received</option>
              <option value="returned">Sale return / stock returned</option>
              <option value="damaged">Damaged goods</option>
              <option value="adjustment_in">
                Stock correction: increase
              </option>
              <option value="adjustment_out">
                Stock correction: decrease
              </option>
            </select>
          </label>

          <label>
            Quantity

            <input
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 5,
              }}
            />
          </label>

          <label>
            Note / reason

            <input
              maxLength={250}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Delivery from supplier"
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                marginTop: 5,
              }}
            />
          </label>

          <button disabled={loading} type="submit">
            {loading ? "Saving..." : "Record stock movement"}
          </button>
        </form>
      )}

      {message && (
        <p
          role="status"
          style={{
            padding: 10,
            background: "#f3f3f3",
          }}
        >
          {message}
        </p>
      )}

      <h2>Current Stock</h2>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">SKU</th>
              <th align="right">Quantity</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td align="right">{product.stockQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 40 }}>Recent Stock Movements</h2>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Product</th>
              <th align="left">Type</th>
              <th align="right">Change</th>
              <th align="left">Note</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td>
                  {new Date(movement.createdAt).toLocaleString()}
                </td>

                <td>{movement.product.name}</td>

                <td>{movement.type}</td>

                <td align="right">
                  {movement.quantityChange > 0 ? "+" : ""}
                  {movement.quantityChange}
                </td>

                <td>{movement.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}