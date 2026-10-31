
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const rowSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(120),
  category: z.string().trim().max(80).optional().default(""),
  unit: z.string().trim().min(1).max(30).optional().default("piece"),
  sellingPrice: z.number().finite().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  barcode: z.string().trim().max(100).optional().default(""),
  costPrice: z.number().finite().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional().default(5),
  proposedSku: z.string().trim().min(1).max(60).optional(),
});

type ImportRow = z.infer<typeof rowSchema>;

type PreviewRow = {
  rowNumber: number;
  data: (ImportRow & { proposedSku?: string }) | null;
  errors: string[];
};

function generateSkuPrefix(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3) || "SKU"
  );
}

async function generateUniqueSku(
  name: string,
  reserved: Set<string>
) {
  const prefix = generateSkuPrefix(name);

  for (let attempt = 0; attempt < 20; attempt++) {
    const sku = `${prefix}-${randomUUID()
      .replace(/-/g, "")
      .slice(0, 6)
      .toUpperCase()}`;

    if (reserved.has(sku)) continue;

    const existing = await prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (!existing) {
      reserved.add(sku);
      return sku;
    }
  }

  throw new Error("Could not generate a unique SKU. Please try again.");
}

async function buildPreview(input: unknown) {
  const rawRows = Array.isArray(input) ? input : [];
  const previewRows: PreviewRow[] = [];

  if (rawRows.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 1,
      rows: [
        {
          rowNumber: 0,
          data: null,
          errors: ["The CSV contains no product rows."],
        },
      ],
    };
  }

  if (rawRows.length > 500) {
    return {
      totalRows: rawRows.length,
      validRows: 0,
      invalidRows: 1,
      rows: [
        {
          rowNumber: 0,
          data: null,
          errors: ["Import is limited to 500 products at a time."],
        },
      ],
    };
  }

  const seenNames = new Set<string>();
  const seenBarcodes = new Set<string>();
  const seenInputSkus = new Set<string>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const parsed = rowSchema.safeParse(raw);

    if (!parsed.success) {
      previewRows.push({
        rowNumber,
        data: null,
        errors: parsed.error.issues.map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      });
      return;
    }

    const data = parsed.data;
    const errors: string[] = [];

    if (
      !Number.isSafeInteger(Math.round(data.sellingPrice * 100)) ||
      Math.round(data.sellingPrice * 100) > 2147483647
    ) {
      errors.push("Selling price is too large.");
    }

    if (
      data.costPrice !== undefined &&
      (
        !Number.isSafeInteger(Math.round(data.costPrice * 100)) ||
        Math.round(data.costPrice * 100) > 2147483647
      )
    ) {
      errors.push("Cost price is too large.");
    }

    const nameKey = data.name.toLowerCase();

    if (seenNames.has(nameKey)) {
      errors.push("Product name is duplicated in this CSV.");
    }
    seenNames.add(nameKey);

    if (data.barcode) {
      if (seenBarcodes.has(data.barcode)) {
        errors.push("Barcode is duplicated in this CSV.");
      }
      seenBarcodes.add(data.barcode);
    }

    if (data.proposedSku) {
      const skuKey = data.proposedSku.toUpperCase();

      if (seenInputSkus.has(skuKey)) {
        errors.push("SKU is duplicated in this CSV.");
      }
      seenInputSkus.add(skuKey);
    }

    previewRows.push({
      rowNumber,
      data,
      errors,
    });
  });

  const existingProducts = await prisma.product.findMany({
    select: { sku: true, barcode: true },
  });

  const existingSkus = new Set(
    existingProducts.map((product) => product.sku.toUpperCase())
  );

  const existingBarcodes = new Set(
    existingProducts
      .map((product) => product.barcode)
      .filter((barcode): barcode is string => Boolean(barcode))
  );

  const reservedSkus = new Set(existingSkus);

  for (const row of previewRows) {
    if (!row.data) continue;

    const data = row.data;

    if (
      data.proposedSku &&
      existingSkus.has(data.proposedSku.toUpperCase())
    ) {
      row.errors.push("SKU already exists in the product catalogue.");
    }

    if (data.barcode && existingBarcodes.has(data.barcode)) {
      row.errors.push("Barcode already exists in the product catalogue.");
    }
  }

  // Generate SKUs only for rows that currently pass validation.
  for (const row of previewRows) {
    if (!row.data || row.errors.length > 0) continue;

    const data = row.data;
    let sku = data.proposedSku;

    if (sku) {
      const key = sku.toUpperCase();

      if (reservedSkus.has(key)) {
        row.errors.push(
          "SKU conflicts with an existing or imported product."
        );
        continue;
      }

      reservedSkus.add(key);
    } else {
      sku = await generateUniqueSku(data.name, reservedSkus);
    }

    row.data = {
      ...data,
      proposedSku: sku,
    };
  }

  const invalidRows = previewRows.filter(
    (row) => row.errors.length > 0 || !row.data?.proposedSku
  ).length;

  return {
    totalRows: rawRows.length,
    validRows: rawRows.length - invalidRows,
    invalidRows,
    rows: previewRows,
  };
}

export async function POST(request: Request) {
  try {
    // FIX: requireAdmin returns { error: Response } when access is denied.
    // Return that response immediately so cashiers cannot import products.
    const auth = await requireAdmin();

    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const action = body?.action;

    if (action !== "preview" && action !== "import") {
      return NextResponse.json(
        { error: "Action must be preview or import." },
        { status: 400 }
      );
    }

    const preview = await buildPreview(body?.rows);

    if (action === "preview") {
      // Return all rows so the UI can show individual validation errors.
      return NextResponse.json(preview);
    }

    if (
      preview.invalidRows > 0 ||
      preview.rows.some(
        (row) =>
          !row.data ||
          !row.data.proposedSku ||
          row.errors.length > 0
      )
    ) {
      return NextResponse.json(
        {
          error: "Please fix the CSV errors and preview the file again.",
          ...preview,
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const importedProducts = [];

      for (const row of preview.rows) {
        const data = row.data!;

        const sellingPricePesewas = Math.round(
          data.sellingPrice * 100
        );

        const costPricePesewas =
          data.costPrice === undefined
            ? null
            : Math.round(data.costPrice * 100);

        const product = await tx.product.create({
          data: {
            name: data.name,
            sku: data.proposedSku!,
            category: data.category || null,
            unit: data.unit || "piece",
            barcode: data.barcode || null,
            sellingPricePesewas,
            costPricePesewas,
            stockQuantity: data.stockQuantity,
            lowStockThreshold: data.lowStockThreshold,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
          },
        });

        if (data.stockQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "received",
              quantityChange: data.stockQuantity,
              reason: "csv_import",
              note: "Opening stock from CSV import",
            },
          });
        }

        importedProducts.push(product);
      }

      return importedProducts;
    });

    return NextResponse.json({
      message: `${created.length} products imported successfully.`,
      importedCount: created.length,
      products: created,
    });
  } catch (error) {
    console.error("CSV product import failed:", error);

    return NextResponse.json(
      { error: "CSV import failed. Check the server logs for details." },
      { status: 500 }
    );
  }
}
