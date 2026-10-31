
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";

const MAX_MONEY_PESEWAS = 2147483647;

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.number().int().positive().max(10000),
      })
    )
    .min(1)
    .max(100),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
  amountPaidPesewas: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_MONEY_PESEWAS),
  reference: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaff();

  if (auth.error) {
    return auth.error;
  }

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

  // Combine duplicate product lines before checking stock or calculating totals.
  const quantities = new Map<string, number>();

  for (const item of items) {
    const combinedQuantity =
      (quantities.get(item.productId) ?? 0) + item.quantity;

    if (!Number.isSafeInteger(combinedQuantity) || combinedQuantity > 10000) {
      return NextResponse.json(
        {
          error: "The combined quantity for a product cannot exceed 10,000.",
        },
        { status: 400 }
      );
    }

    quantities.set(item.productId, combinedQuantity);
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

        if (
          !Number.isSafeInteger(product.sellingPricePesewas) ||
          product.sellingPricePesewas < 0 ||
          product.sellingPricePesewas > MAX_MONEY_PESEWAS
        ) {
          throw new Error("PRICE_OUT_OF_RANGE");
        }

        if (product.stockQuantity < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        const lineTotalPesewas = product.sellingPricePesewas * quantity;

        if (
          !Number.isSafeInteger(lineTotalPesewas) ||
          lineTotalPesewas > MAX_MONEY_PESEWAS
        ) {
          throw new Error("PRICE_OUT_OF_RANGE");
        }

        subtotalPesewas += lineTotalPesewas;

        if (
          !Number.isSafeInteger(subtotalPesewas) ||
          subtotalPesewas > MAX_MONEY_PESEWAS
        ) {
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

      // This version supports full payment only; partial payments are not allowed.
      if (amountPaidPesewas < subtotalPesewas) {
        throw new Error("PAYMENT_INSUFFICIENT");
      }

      if (
        paymentMethod !== "cash" &&
        amountPaidPesewas !== subtotalPesewas
      ) {
        throw new Error("NON_CASH_AMOUNT_MUST_MATCH_TOTAL");
      }

      const changePesewas = amountPaidPesewas - subtotalPesewas;

      const receiptNumber =
        `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
        randomUUID().slice(0, 8).toUpperCase();

      // Conditionally deduct stock so a sale cannot proceed if stock
      // is no longer sufficient when the update is attempted.
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
          staffId: auth.staff.id,
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
          staff: {
            select: {
              username: true,
            },
          },
        },
      });

      // Stock movements and the sale are committed or rolled back together.
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
        { error: `${message.slice("INSUFFICIENT_STOCK:".length)} has insufficient stock.` },
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
        {
          error:
            "For Mobile Money or card, amount paid must equal the total.",
        },
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
      {
        error: "Could not complete the sale. Please check the sales history before retrying.",
      },
      { status: 500 }
    );
  }
}
