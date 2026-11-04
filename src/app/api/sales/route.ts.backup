
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("q") ?? "").trim().slice(0, 100);

    const sales = await prisma.sale.findMany({
      where: search
        ? {
            receiptNumber: {
              contains: search,
            },
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: true,
        staff: {
          select: {
            username: true,
          },
        },
      },
      take: 200,
    });

    return NextResponse.json({
      sales,
      count: sales.length,
    });
  } catch (error) {
    console.error("Sales history error:", error);

    return NextResponse.json(
      { error: "Could not load sales history." },
      { status: 500 }
    );
  }
}
