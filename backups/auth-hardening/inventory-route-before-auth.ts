import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum([
    "received",
    "sold",
    "damaged",
    "adjustment_in",
    "adjustment_out",
    "returned",
  ]),
  quantity: z.number().int().positive(),
  note: z.string().trim().max(250).optional().nullable(),
});

export async function GET() {
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
      });

      if (!product || !product.isActive) {
        return { kind: "not_found" as const };
      }

      if (!incoming && product.stockQuantity < quantity) {
        return { kind: "insufficient" as const };
      }

      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          ...(incoming ? {} : { stockQuantity: { gte: quantity } }),
        },
        data: {
          stockQuantity: { increment: quantityChange },
        },
      });

      if (updated.count !== 1) {
        return { kind: "insufficient" as const };
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

    if (result.kind === "insufficient") {
      return NextResponse.json(
        {
          error:
            "Insufficient stock, or stock changed. Refresh and try again.",
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