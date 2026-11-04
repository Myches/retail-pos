
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function parseDate(value: string | null): Date | null | "invalid" {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "invalid";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return "invalid";
  }

  return date;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("q") ?? "").trim().slice(0, 100);
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));

    if (from === "invalid" || to === "invalid") {
      return NextResponse.json(
        { error: "Invalid date. Use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    if (from && to && from > to) {
      return NextResponse.json(
        { error: "The start date cannot be after the end date." },
        { status: 400 }
      );
    }

    const requestedPage = Number(searchParams.get("page") ?? "1");
    const requestedLimit = Number(searchParams.get("limit") ?? "20");

    if (
      !Number.isInteger(requestedPage) ||
      requestedPage < 1 ||
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1
    ) {
      return NextResponse.json(
        { error: "Invalid page or limit." },
        { status: 400 }
      );
    }

    const page = requestedPage;
    const limit = Math.min(requestedLimit, 200);
    const skip = (page - 1) * limit;

    const endDate = to
      ? new Date(to.getTime() + 24 * 60 * 60 * 1000)
      : null;

    const where = {
      ...(search
        ? {
            receiptNumber: {
              contains: search,
            },
          }
        : {}),
      ...(from || endDate
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(endDate ? { lt: endDate } : {}),
            },
          }
        : {}),
    };

    // Daily summary is independent of search and pagination.
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const todayWhere = {
      createdAt: {
        gte: todayStart,
        lt: tomorrowStart,
      },
    };

    const [sales, count, dailySummary] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          items: true,
          staff: {
            select: {
              username: true,
            },
          },
          payments: {
            orderBy: {
              createdAt: "asc",
            },
          },
          returns: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              items: true,
            },
          },
        },
      }),
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where: todayWhere,
        _count: {
          _all: true,
        },
        _sum: {
          totalPesewas: true,
        },
      }),
    ]);

    return NextResponse.json({
      sales,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      dailySummary: {
        count: dailySummary._count._all,
        totalPesewas: dailySummary._sum.totalPesewas ?? 0,
      },
    });
  } catch (error) {
    console.error("Sales history error:", error);

    return NextResponse.json(
      { error: "Could not load sales history." },
      { status: 500 }
    );
  }
}
