
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const MAX_STOCK_QUANTITY = 2147483647;

const movementSchema = z.object({
  productId: z.string().trim().min(1),
  type: z.enum([
    "received",
    "sold",
    "damaged",
    "adjustment_in",
    "adjustment_out",
    "returned",
  ]),
  quantity: z.number().int().positive().max(MAX_STOCK_QUANTITY),
  note: z.string().trim().max(250).optional().nullable(),
});

export async function GET() {
 const auth = await requireAdmin();
if (auth.error) return auth.error;

  try {
    const movements = await prisma.stockMovement.findMany({
      include: {
        product: {
          select: { name: true, sku: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(movements);
  } catch (error) {
    console.error("Inventory GET error:", error);

    return NextResponse.json(
      { error: "Could not load stock history." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

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

  const parsed = movementSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid movement details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { productId, type, quantity, note } = parsed.data;

  if (type === "sold") {
    return NextResponse.json(
      { error: "Stock sold must be recorded through checkout." },
      { status: 400 }
    );
  }

  const incoming = ["received", "returned", "adjustment_in"].includes(type);
  const quantityChange = incoming ? quantity : -quantity;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          isActive: true,
          stockQuantity: true,
        },
      });

      if (!product || !product.isActive) {
        return { kind: "not_found" as const };
      }

      if (
        incoming &&
        product.stockQuantity > MAX_STOCK_QUANTITY - quantity
      ) {
        return { kind: "quantity_limit" as const };
      }

      if (!incoming && product.stockQuantity < quantity) {
        return { kind: "insufficient" as const };
      }

      // Only update if the product is still active and the stock
      // quantity is within the permitted range.
      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          isActive: true,
          ...(incoming
            ? {
                stockQuantity: {
                  lte: MAX_STOCK_QUANTITY - quantity,
                },
              }
            : {
                stockQuantity: {
                  gte: quantity,
                },
              }),
        },
        data: {
          stockQuantity: { increment: quantityChange },
        },
      });

      if (updated.count !== 1) {
        return { kind: "conflict" as const };
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantityChange,
          reason: type,
          note: note || null,
        },
      });

      const updatedProduct = await tx.product.findUnique({
        where: { id: productId },
      });

      return {
        kind: "ok" as const,
        movement,
        product: updatedProduct,
      };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { error: "Active product not found." },
        { status: 404 }
      );
    }

    if (result.kind === "quantity_limit") {
      return NextResponse.json(
        { error: "This adjustment would exceed the maximum supported stock quantity." },
        { status: 400 }
      );
    }

    if (result.kind === "insufficient") {
      return NextResponse.json(
        { error: "Insufficient stock for this adjustment." },
        { status: 409 }
      );
    }

    if (result.kind === "conflict") {
      return NextResponse.json(
        {
          error:
            "Stock changed or the product became unavailable. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Inventory POST error:", error);

    return NextResponse.json(
      { error: "Could not record stock movement." },
      { status: 500 }
    );
  }
}
