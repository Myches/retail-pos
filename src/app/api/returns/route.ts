
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type ReturnRequestItem = {
  saleItemId: string;
  quantity: number;
  restocked?: boolean;
};

type ReturnRequest = {
  receiptNumber: string;
  items: ReturnRequestItem[];
  refundMethod: string;
  reason?: string;
};

const allowedRefundMethods = ["cash", "mobile_money", "card"];
const MAX_STOCK_QUANTITY = 2147483647;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownError(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}

function createReturnNumber() {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `RET-${datePart}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON request body.", 400);
  }

  if (!isObject(rawBody)) {
    return errorResponse("Invalid request body.", 400);
  }

  const receiptNumber =
    typeof rawBody.receiptNumber === "string"
      ? rawBody.receiptNumber.trim()
      : "";

  const refundMethod =
    typeof rawBody.refundMethod === "string"
      ? rawBody.refundMethod.trim()
      : "";

  const reason =
    typeof rawBody.reason === "string"
      ? rawBody.reason.trim()
      : "";

  const rawItems = rawBody.items;

  if (!receiptNumber) {
    return errorResponse("Receipt number is required.", 400);
  }

  if (!allowedRefundMethods.includes(refundMethod)) {
    return errorResponse("Invalid refund method.", 400);
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return errorResponse("Select at least one item to return.", 400);
  }

  if (rawItems.length > 100) {
    return errorResponse("Too many return items in one request.", 400);
  }

  if (reason.length > 500) {
    return errorResponse("Return reason cannot exceed 500 characters.", 400);
  }

  const combinedItems = new Map<
    string,
    { saleItemId: string; quantity: number; restocked: boolean }
  >();

  for (const rawItem of rawItems) {
    if (!isObject(rawItem)) {
      return errorResponse("Invalid return item.", 400);
    }

    const saleItemId =
      typeof rawItem.saleItemId === "string"
        ? rawItem.saleItemId.trim()
        : "";

    const quantity = rawItem.quantity;
    const restocked = rawItem.restocked;

    if (!saleItemId) {
      return errorResponse("Every return item must have a sale item ID.", 400);
    }

    if (
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return errorResponse("Return quantities must be positive whole numbers.", 400);
    }

    if (restocked !== undefined && typeof restocked !== "boolean") {
      return errorResponse("Invalid restocking choice.", 400);
    }

    const existing = combinedItems.get(saleItemId);

    if (existing) {
      const combinedQuantity = existing.quantity + quantity;

      if (!Number.isSafeInteger(combinedQuantity)) {
        return errorResponse("Invalid combined return quantity.", 400);
      }

      existing.quantity = combinedQuantity;
    } else {
      combinedItems.set(saleItemId, {
        saleItemId,
        quantity,
        restocked: restocked !== false,
      });
    }
  }

  const items = Array.from(combinedItems.values());

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { receiptNumber },
        include: { items: true },
      });

      if (!sale) {
        throw new Error("SALE_NOT_FOUND");
      }

      if (sale.status !== "completed") {
        throw new Error("SALE_NOT_COMPLETED");
      }

      if (sale.paymentMethod !== refundMethod) {
        throw new Error("REFUND_METHOD_MISMATCH");
      }

      const preparedItems: Array<{
        saleItemId: string;
        productId: string;
        productName: string;
        quantity: number;
        unitPricePesewas: number;
        restocked: boolean;
      }> = [];

      let refundAmountPesewas = 0;

      for (const requested of items) {
        const saleItem = sale.items.find(
          (item) => item.id === requested.saleItemId
        );

        if (!saleItem) {
          throw new Error("ITEM_NOT_IN_SALE");
        }

        const previousReturns = await tx.saleReturnItem.aggregate({
          where: { saleItemId: saleItem.id },
          _sum: { quantity: true },
        });

        const alreadyReturned = previousReturns._sum.quantity ?? 0;
        const remainingQuantity = saleItem.quantity - alreadyReturned;

        if (
          !Number.isSafeInteger(remainingQuantity) ||
          remainingQuantity < 0 ||
          requested.quantity > remainingQuantity
        ) {
          throw new Error("RETURN_QUANTITY_EXCEEDED");
        }

        const lineRefund = saleItem.unitPricePesewas * requested.quantity;

        if (
          !Number.isSafeInteger(lineRefund) ||
          lineRefund < 0
        ) {
          throw new Error("INVALID_REFUND_AMOUNT");
        }

        refundAmountPesewas += lineRefund;

        if (!Number.isSafeInteger(refundAmountPesewas)) {
          throw new Error("INVALID_REFUND_AMOUNT");
        }

        preparedItems.push({
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          productName: saleItem.productName,
          quantity: requested.quantity,
          unitPricePesewas: saleItem.unitPricePesewas,
          restocked: requested.restocked,
        });
      }

      if (refundAmountPesewas <= 0) {
        throw new Error("INVALID_REFUND_AMOUNT");
      }

      const returnNumber = createReturnNumber();

      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          refundAmountPesewas,
          refundMethod,
          reason: reason || null,
          items: {
            create: preparedItems.map((item) => ({
              saleItemId: item.saleItemId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPricePesewas: item.unitPricePesewas,
              restocked: item.restocked,
            })),
          },
        },
      });

      for (const item of preparedItems) {
        if (!item.restocked) {
          continue;
        }

        const updatedProduct = await tx.product.updateMany({
  where: {
    id: item.productId,
    stockQuantity: {
      lte: MAX_STOCK_QUANTITY - item.quantity,
    },
  },
  data: {
    stockQuantity: { increment: item.quantity },
  },
});

if (updatedProduct.count !== 1) {
  throw new Error("STOCK_LIMIT_EXCEEDED");
}

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "returned",
            quantityChange: item.quantity,
            reason: "Customer return",
            note: `Return ${returnNumber} for receipt ${receiptNumber}`,
          },
        });
      }

      return {
        returnNumber: saleReturn.returnNumber,
        receiptNumber,
        refundAmountPesewas: saleReturn.refundAmountPesewas,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {

if (isKnownError(error, "STOCK_LIMIT_EXCEEDED")) {
  return errorResponse(
    "Restocking would exceed the maximum supported stock quantity. No return was completed.",
    400
  );
}

    if (isKnownError(error, "SALE_NOT_FOUND")) {
      return errorResponse("Sale receipt was not found.", 404);
    }

    if (isKnownError(error, "SALE_NOT_COMPLETED")) {
      return errorResponse("Only completed sales can be returned.", 400);
    }

    if (isKnownError(error, "REFUND_METHOD_MISMATCH")) {
      return errorResponse(
        "The refund method must match the original payment method.",
        400
      );
    }

    if (isKnownError(error, "ITEM_NOT_IN_SALE")) {
      return errorResponse(
        "One or more selected items do not belong to this receipt.",
        400
      );
    }

    if (isKnownError(error, "RETURN_QUANTITY_EXCEEDED")) {
      return errorResponse(
        "The requested quantity exceeds the quantity still available to return.",
        400
      );
    }

    if (isKnownError(error, "INVALID_REFUND_AMOUNT")) {
      return errorResponse("The refund amount is invalid.", 400);
    }

    console.error("Failed to process return:", error);

    return errorResponse(
      "Could not process the return. No return should be considered successful unless it was saved.",
      500
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const receiptNumber = searchParams.get("q")?.trim();

  if (!receiptNumber) {
    return errorResponse("A receipt number is required.", 400);
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });

    if (!sale) {
      return errorResponse("Sale receipt was not found.", 404);
    }

    const returnedItems = await prisma.saleReturnItem.groupBy({
      by: ["saleItemId"],
      where: {
        saleReturn: {
          saleId: sale.id,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const returnedQuantities: Record<string, number> = {};

    for (const item of returnedItems) {
      returnedQuantities[item.saleItemId] = item._sum.quantity ?? 0;
    }

    return NextResponse.json({ returnedQuantities });
  } catch (error) {
    console.error("Failed to fetch return history:", error);

    return errorResponse("Could not retrieve return history.", 500);
  }
}
