import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";


const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(60),
  barcode: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(30).default("piece"),
  sellingPricePesewas: z.number().int().nonnegative(),
  costPricePesewas: z.number().int().nonnegative().optional().nullable(),
  stockQuantity: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { error: "Could not load products." },
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

  const result = productSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid product details.", details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.create({
      data: result.data,
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
  sellingPricePesewas: z.number().int().nonnegative().optional(),
  costPricePesewas: z.number().int().nonnegative().nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request) {
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
      { error: "Invalid product details.", details: result.error.flatten() },
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
      data,
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

    return NextResponse.json(
      { error: "Could not update product." },
      { status: 500 }
    );
  }
}