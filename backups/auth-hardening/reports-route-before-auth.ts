
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function moneyTotal(
  sales: Array<{ totalPesewas: number }>
): number {
  return sales.reduce((total, sale) => total + sale.totalPesewas, 0);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const sevenDaysStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    );

    const completedSales = {
      status: "completed",
    };

    const [
      todaySales,
      monthSales,
      todayReturns,
      monthReturns,
      sevenDaySales,
      recentSales,
      lowStockProducts,
    ] = await Promise.all([
      // Completed sales today
      prisma.sale.findMany({
        where: {
          ...completedSales,
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        include: { items: true },
      }),

      // Completed sales this month
      prisma.sale.findMany({
        where: {
          ...completedSales,
          createdAt: { gte: monthStart },
        },
        include: { items: true },
      }),

      // Returns recorded today
      prisma.saleReturn.findMany({
        where: {
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        include: {
          items: {
            include: {
              saleItem: {
                select: {
                  unitCostPesewas: true,
                },
              },
            },
          },
        },
      }),

      // Returns recorded this month
      prisma.saleReturn.findMany({
        where: {
          createdAt: { gte: monthStart },
        },
        include: {
          items: {
            include: {
              saleItem: {
                select: {
                  unitCostPesewas: true,
                },
              },
            },
          },
        },
      }),

      // Completed sales over the last seven calendar days
      prisma.sale.findMany({
        where: {
          ...completedSales,
          createdAt: {
            gte: sevenDaysStart,
            lt: tomorrowStart,
          },
        },
        select: {
          createdAt: true,
          totalPesewas: true,
        },
      }),

      // Most recent sales
      prisma.sale.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { items: true },
      }),

      // Fetch active products, then apply their individual thresholds
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          lowStockThreshold: true,
        },
        orderBy: { stockQuantity: "asc" },
      }),
    ]);

    // Build the seven-day revenue chart
    const dailyTotals = new Map<string, number>();

    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset
      );

      dailyTotals.set(dateKey(day), 0);
    }

    for (const sale of sevenDaySales) {
      const key = dateKey(new Date(sale.createdAt));

      dailyTotals.set(
        key,
        (dailyTotals.get(key) ?? 0) + sale.totalPesewas
      );
    }

    // Subtract returns from the chart on the day the return was recorded
    const sevenDayReturns = await prisma.saleReturn.findMany({
      where: {
        createdAt: {
          gte: sevenDaysStart,
          lt: tomorrowStart,
        },
      },
      select: {
        createdAt: true,
        refundAmountPesewas: true,
      },
    });

    for (const saleReturn of sevenDayReturns) {
      const key = dateKey(new Date(saleReturn.createdAt));

      dailyTotals.set(
        key,
        (dailyTotals.get(key) ?? 0) -
          saleReturn.refundAmountPesewas
      );
    }

    const lastSevenDays = Array.from(dailyTotals.entries())
      .map(([date, revenuePesewas]) => ({
        date,
        revenuePesewas,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Estimate gross profit using the saved cost at the time of sale
    const calculateProfit = (
      sales: Array<{
        items: Array<{
          quantity: number;
          unitPricePesewas: number;
          unitCostPesewas: number | null;
        }>;
      }>
    ) => {
      let knownProfitPesewas = 0;
      let itemsMissingCost = 0;

      for (const sale of sales) {
        for (const item of sale.items) {
          if (item.unitCostPesewas === null) {
            itemsMissingCost += 1;
            continue;
          }

          knownProfitPesewas +=
            (item.unitPricePesewas - item.unitCostPesewas) *
            item.quantity;
        }
      }

      return { knownProfitPesewas, itemsMissingCost };
    };

    const calculateReturnedProfit = (
      returns: typeof todayReturns
    ) => {
      let knownProfitPesewas = 0;
      let itemsMissingCost = 0;

      for (const saleReturn of returns) {
        for (const item of saleReturn.items) {
          const cost = item.saleItem.unitCostPesewas;

          if (cost === null) {
            itemsMissingCost += 1;
            continue;
          }

          knownProfitPesewas +=
            (item.unitPricePesewas - cost) * item.quantity;
        }
      }

      return { knownProfitPesewas, itemsMissingCost };
    };

    const todayProfit = calculateProfit(todaySales);
    const monthProfit = calculateProfit(monthSales);

    const todayReturnedProfit =
      calculateReturnedProfit(todayReturns);
    const monthReturnedProfit =
      calculateReturnedProfit(monthReturns);

    const todayRefundsPesewas = todayReturns.reduce(
      (total, item) => total + item.refundAmountPesewas,
      0
    );

    const monthRefundsPesewas = monthReturns.reduce(
      (total, item) => total + item.refundAmountPesewas,
      0
    );

    const lowStockAlerts = lowStockProducts.filter(
      (product) =>
        product.stockQuantity <= product.lowStockThreshold
    );

    return NextResponse.json({
      generatedAt: now.toISOString(),

      today: {
        salesCount: todaySales.length,
        revenuePesewas:
          moneyTotal(todaySales) - todayRefundsPesewas,
        refundsPesewas: todayRefundsPesewas,
        estimatedGrossProfitPesewas:
          todayProfit.knownProfitPesewas -
          todayReturnedProfit.knownProfitPesewas,
        itemsMissingCost:
          todayProfit.itemsMissingCost +
          todayReturnedProfit.itemsMissingCost,
      },

      month: {
        salesCount: monthSales.length,
        revenuePesewas:
          moneyTotal(monthSales) - monthRefundsPesewas,
        refundsPesewas: monthRefundsPesewas,
        estimatedGrossProfitPesewas:
          monthProfit.knownProfitPesewas -
          monthReturnedProfit.knownProfitPesewas,
        itemsMissingCost:
          monthProfit.itemsMissingCost +
          monthReturnedProfit.itemsMissingCost,
      },

      lastSevenDays,

      lowStockProducts: lowStockAlerts,

      recentSales: recentSales.map((sale) => ({
  id: sale.id,
  receiptNumber: sale.receiptNumber,
  totalPesewas: sale.totalPesewas,
  paymentMethod: sale.paymentMethod,
  status: sale.status,
  createdAt: sale.createdAt,

  itemCount: sale.items.reduce(
    (count, item) => count + item.quantity,
    0
  ),

  items: sale.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
  })),
})),
    });
  } catch (error) {
    console.error("Reports API error:", error);

    return NextResponse.json(
      { error: "Could not load dashboard reports." },
      { status: 500 }
    );
  }
}
