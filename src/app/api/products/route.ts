
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth";

const MAX_MONEY_PESEWAS = 2147483647;

async function generateUniqueSku(productName: string): Promise<string> {
  const prefix =
    productName
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3) || "SKU";

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = randomUUID()
      .replace(/-/g, "")
      .slice(0, 6)
      .toUpperCase();

    const sku = `${prefix}-${suffix}`;

    const existing = await prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (!existing) {
      return sku;
    }
  }

  throw new Error("SKU_GENERATION_FAILED");
}

const moneySchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_MONEY_PESEWAS);

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  barcode: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(30).default("piece"),
  sellingPricePesewas: moneySchema,
  costPricePesewas: moneySchema.optional().nullable(),
  stockQuantity: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export async function GET() {
  const auth = await requireStaff();

  if (auth.error) {
    return auth.error;
  }

  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (auth.staff.role === "CASHIER") {
      const cashierProducts = products.map(
        ({ costPricePesewas, ...product }) => product
      );

      return NextResponse.json(cashierProducts);
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error("Could not load products:", error);

    return NextResponse.json(
      { error: "Could not load products." },
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

  const result = productSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid product details.",
        details: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const { sku: requestedSku, ...productData } = result.data;

    const sku =
      requestedSku || (await generateUniqueSku(productData.name));

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          ...productData,
          sku,
          barcode: productData.barcode || null,
          category: productData.category || null,
        },
      });

      if (createdProduct.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: createdProduct.id,
            type: "received",
            quantityChange: createdProduct.stockQuantity,
            reason: "initial_stock",
            note: "Opening stock when product was created",
          },
        });
      }

      return createdProduct;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That SKU or barcode is already in use." },
        { status: 409 }
      );
    }

    console.error("Could not save product:", error);

    return NextResponse.json(
      { error: "Could not save product." },
      { status: 500 }
    );
  }
}

const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().min(1).max(60).optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  sellingPricePesewas: moneySchema.optional(),
  costPricePesewas: moneySchema.nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request) {
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

  const result = updateProductSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid product details.",
        details: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { id, ...data } = result.data;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No changes provided." },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(data.barcode !== undefined
          ? { barcode: data.barcode || null }
          : {}),
        ...(data.category !== undefined
          ? { category: data.category || null }
          : {}),
      },
    });

    return NextResponse.json(product);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That SKU or barcode is already in use." },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    console.error("Could not update product:", error);

    return NextResponse.json(
      { error: "Could not update product." },
      { status: 500 }
    );
  }
}
