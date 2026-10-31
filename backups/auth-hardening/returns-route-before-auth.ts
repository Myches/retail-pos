
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReturnRequest;

    if (
      typeof body.receiptNumber !== "string" ||
      !body.receiptNumber.trim()
    ) {
      return NextResponse.json(
        { error: "A receipt number is required." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        { error: "Select at least one item to return." },
        { status: 400 }
      );
    }

    if (
      typeof body.refundMethod !== "string" ||
      !allowedRefundMethods.includes(body.refundMethod)
    ) {
      return NextResponse.json(
        { error: "Choose cash, mobile_money, or card." },
        { status: 400 }
      );
    }

    const combinedItems = new Map<string, number>();

    for (const item of body.items) {
      if (
        typeof item.saleItemId !== "string" ||
        !item.saleItemId.trim() ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        (item.restocked !== undefined &&
          typeof item.restocked !== "boolean")
      ) {
        return NextResponse.json(
          {
            error:
              "Each return item needs a valid sale item ID and a positive whole-number quantity.",
          },
          { status: 400 }
        );
      }

      combinedItems.set(
        item.saleItemId,
        (combinedItems.get(item.saleItemId) ?? 0) +
          item.quantity
      );
    }

    const returnItems = Array.from(
      combinedItems.entries()
    ).map(([saleItemId, quantity]) => ({
      saleItemId,
      quantity,
      restocked:
        body.items.find(
          (item) => item.saleItemId === saleItemId
        )?.restocked ?? true,
    }));

    if (
      returnItems.some(
        (item) => !Number.isSafeInteger(item.quantity)
      )
    ) {
      return NextResponse.json(
        { error: "The combined return quantity is too large." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: {
          receiptNumber: body.receiptNumber.trim(),
        },
        include: {
          items: true,
        },
      });

      if (!sale) {
        throw new Error("SALE_NOT_FOUND");
      }

      if (sale.status !== "completed") {
        throw new Error("SALE_NOT_COMPLETED");
      }

      const preparedItems = [];
      let refundAmountPesewas = 0;

      for (const requestedItem of returnItems) {
        const saleItem = sale.items.find(
          (item) => item.id === requestedItem.saleItemId
        );

        if (!saleItem) {
          throw new Error("ITEM_NOT_IN_SALE");
        }

        const previousReturns =
          await tx.saleReturnItem.aggregate({
            where: {
              saleItemId: saleItem.id,
            },
            _sum: {
              quantity: true,
            },
          });

        const alreadyReturned =
          previousReturns._sum.quantity ?? 0;

        if (
          alreadyReturned + requestedItem.quantity >
          saleItem.quantity
        ) {
          throw new Error("RETURN_QUANTITY_EXCEEDED");
        }

        const lineRefund =
          saleItem.unitPricePesewas *
          requestedItem.quantity;

        if (!Number.isSafeInteger(lineRefund)) {
          throw new Error("INVALID_REFUND_AMOUNT");
        }

        refundAmountPesewas += lineRefund;

        preparedItems.push({
          saleItem,
          quantity: requestedItem.quantity,
          restocked: requestedItem.restocked,
          lineRefund,
        });
      }

      if (!Number.isSafeInteger(refundAmountPesewas)) {
        throw new Error("INVALID_REFUND_AMOUNT");
      }

      const returnNumber =
        `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          refundAmountPesewas,
          refundMethod: body.refundMethod,
          reason:
            typeof body.reason === "string"
              ? body.reason.trim().slice(0, 500) || null
              : null,
          items: {
            create: preparedItems.map((item) => ({
              saleItemId: item.saleItem.id,
              productId: item.saleItem.productId,
              productName: item.saleItem.productName,
              quantity: item.quantity,
              unitPricePesewas:
                item.saleItem.unitPricePesewas,
              restocked: item.restocked,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of preparedItems) {
        if (!item.restocked) {
          continue;
        }

        await tx.product.update({
          where: {
            id: item.saleItem.productId,
          },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.saleItem.productId,
            type: "returned",
            quantityChange: item.quantity,
            reason: "Customer return",
            note: `Return ${returnNumber} for receipt ${sale.receiptNumber}`,
          },
        });
      }

      return {
        saleReturn,
        receiptNumber: sale.receiptNumber,
        refundAmountPesewas,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        SALE_NOT_FOUND: "The original receipt was not found.",
        SALE_NOT_COMPLETED:
          "Only completed sales can be returned.",
        ITEM_NOT_IN_SALE:
          "One or more selected items do not belong to this receipt.",
        RETURN_QUANTITY_EXCEEDED:
          "The return exceeds the quantity originally sold, after accounting for previous returns.",
        INVALID_REFUND_AMOUNT:
          "The refund amount is invalid or too large.",
      };

      const message = messages[error.message];

      if (message) {
        return NextResponse.json(
          { error: message },
          {
            status:
              error.message === "SALE_NOT_FOUND" ? 404 : 400,
          }
        );
      }
    }

    console.error("Sales return API error:", error);

    return NextResponse.json(
      { error: "Could not process the return." },
      { status: 500 }
    );
  }
}



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptNumber = searchParams.get("q")?.trim();

    if (!receiptNumber) {
      return NextResponse.json(
        { error: "A receipt number is required." },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "The original receipt was not found." },
        { status: 404 }
      );
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
      returnedQuantities[item.saleItemId] =
        item._sum.quantity ?? 0;
    }

    return NextResponse.json({ returnedQuantities });
  } catch (error) {
    console.error("Return lookup API error:", error);

    return NextResponse.json(
      { error: "Could not load previous returns." },
      { status: 500 }
    );
  }
}
