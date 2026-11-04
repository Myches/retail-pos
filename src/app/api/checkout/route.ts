
import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
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

const saleInclude = {
  items: true,
  payments: true,
  staff: {
    select: {
      username: true,
    },
  },
} satisfies Prisma.SaleInclude;

function requestHash(data: {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  amountPaidPesewas: number;
  reference?: string;
}) {
  const canonicalRequest = JSON.stringify({
    items: [...data.items].sort((a, b) =>
      a.productId.localeCompare(b.productId)
    ),
    paymentMethod: data.paymentMethod,
    amountPaidPesewas: data.amountPaidPesewas,
    reference: data.reference || null,
  });

  return createHash("sha256").update(canonicalRequest).digest("hex");
}

function existingSaleResponse(
  sale: { checkoutRequestHash: string | null } & object,
  expectedHash: string
) {
  if (sale.checkoutRequestHash !== expectedHash) {
    return NextResponse.json(
      {
        error:
          "This checkout key has already been used for different sale details. Start a new checkout attempt.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ sale }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireStaff();

  if (auth.error) {
    return auth.error;
  }

  const keyResult = z.string().uuid().safeParse(
    request.headers.get("Idempotency-Key")
  );

  if (!keyResult.success) {
    return NextResponse.json(
      { error: "A valid checkout idempotency key is required." },
      { status: 400 }
    );
  }

  const idempotencyKey = keyResult.data;

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

  const normalizedItems = [...quantities.entries()].map(
    ([productId, quantity]) => ({ productId, quantity })
  );

  const checkoutRequestHash = requestHash({
    items: normalizedItems,
    paymentMethod,
    amountPaidPesewas,
    reference,
  });

  try {
    // Return the original sale if this request was already completed.
    const previousSale = await prisma.sale.findUnique({
      where: { idempotencyKey },
      include: saleInclude,
    });

    if (previousSale) {
      return existingSaleResponse(previousSale, checkoutRequestHash);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check again inside the transaction in case the request was completed
      // after the initial lookup.
      const saleWithKey = await tx.sale.findUnique({
        where: { idempotencyKey },
        include: saleInclude,
      });

      if (saleWithKey) {
        if (saleWithKey.checkoutRequestHash !== checkoutRequestHash) {
          throw new Error("IDEMPOTENCY_KEY_REUSED");
        }

        return { sale: saleWithKey, duplicate: true };
      }

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
          idempotencyKey,
          checkoutRequestHash,
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
        include: saleInclude,
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

      return { sale, duplicate: false };
    });

    return NextResponse.json(
      { sale: result.sale },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "IDEMPOTENCY_KEY_REUSED") {
      return NextResponse.json(
        {
          error:
            "This checkout key has already been used for different sale details.",
        },
        { status: 409 }
      );
    }

    // If another simultaneous request won the unique-key race,
    // return its completed sale rather than creating another one.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winningSale = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: saleInclude,
      });

      if (winningSale) {
        return existingSaleResponse(winningSale, checkoutRequestHash);
      }
    }

    if (message === "PRODUCT_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "One or more products are unavailable." },
        { status: 400 }
      );
    }

    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json(
        {
          error: `${message.slice("INSUFFICIENT_STOCK:".length)} has insufficient stock.`,
        },
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
        error:
          "Could not complete the sale. Please check the sales history before retrying.",
      },
      { status: 500 }
    );
  }
}
