
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(10000),
      })
    )
    .min(1)
    .max(100),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
  amountPaidPesewas: z.number().int().nonnegative(),
  reference: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid checkout details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { items, paymentMethod, amountPaidPesewas, reference } = parsed.data;

  // Combine duplicate product lines to avoid charging/deducting them twice.
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const saleItems: Array<{
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitPricePesewas: number;
        unitCostPesewas: number | null;
        lineTotalPesewas: number;
      }> = [];

      let subtotalPesewas = 0;

      for (const [productId, quantity] of quantities) {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product || !product.isActive) {
          throw new Error("PRODUCT_NOT_AVAILABLE");
        }

        if (product.stockQuantity < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        const lineTotalPesewas = product.sellingPricePesewas * quantity;

        if (!Number.isSafeInteger(lineTotalPesewas)) {
          throw new Error("PRICE_OUT_OF_RANGE");
        }

        subtotalPesewas += lineTotalPesewas;

        if (!Number.isSafeInteger(subtotalPesewas)) {
          throw new Error("PRICE_OUT_OF_RANGE");
        }

        saleItems.push({
          productId,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPricePesewas: product.sellingPricePesewas,
          unitCostPesewas: product.costPricePesewas,
          lineTotalPesewas,
        });
      }

      // This first version supports full payment only; no partial payments.
      if (amountPaidPesewas < subtotalPesewas) {
        throw new Error("PAYMENT_INSUFFICIENT");
      }

      if (paymentMethod !== "cash" && amountPaidPesewas !== subtotalPesewas) {
        throw new Error("NON_CASH_AMOUNT_MUST_MATCH_TOTAL");
      }

      const changePesewas = amountPaidPesewas - subtotalPesewas;

      const receiptNumber =
        `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
        randomUUID().slice(0, 8).toUpperCase();

      // Reserve stock with a conditional update. If stock changed meanwhile,
      // the transaction is rejected rather than allowing negative inventory.
      for (const item of saleItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            stockQuantity: { gte: item.quantity },
          },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
        }
      }

      const sale = await tx.sale.create({
        data: {
          receiptNumber,
          subtotalPesewas,
          totalPesewas: subtotalPesewas,
          amountPaidPesewas,
          changePesewas,
          paymentMethod,
          status: "completed",
          items: {
            create: saleItems,
          },
          payments: {
            create: {
              method: paymentMethod,
              amountPesewas: subtotalPesewas,
              reference: reference || null,
            },
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      // Record the stock deductions in the same transaction as the sale.
      for (const item of saleItems) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "sold",
            quantityChange: -item.quantity,
            reason: "sale",
            note: `Receipt ${receiptNumber}`,
          },
        });
      }

      return sale;
    });

    return NextResponse.json({ sale: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "PRODUCT_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "One or more products are unavailable." },
        { status: 400 }
      );
    }

    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json(
        { error: `${message.split(":")[1]} has insufficient stock.` },
        { status: 409 }
      );
    }

    if (message === "PAYMENT_INSUFFICIENT") {
      return NextResponse.json(
        { error: "Amount received is less than the total." },
        { status: 400 }
      );
    }

    if (message === "NON_CASH_AMOUNT_MUST_MATCH_TOTAL") {
      return NextResponse.json(
        { error: "For Mobile Money or card, amount paid must equal the total." },
        { status: 400 }
      );
    }

    if (message === "PRICE_OUT_OF_RANGE") {
      return NextResponse.json(
        { error: "The sale total exceeds the supported amount." },
        { status: 400 }
      );
    }

    console.error("Checkout error:", error);

    return NextResponse.json(
      { error: "Could not complete the sale. No changes should have been saved." },
      { status: 500 }
    );
  }
}
