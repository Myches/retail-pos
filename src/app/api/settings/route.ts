
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth";

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(100),
  address: z.string().trim().max(250).nullable(),
  phone: z.string().trim().max(30).nullable(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).nullable(),
  receiptFooter: z.string().trim().max(250).nullable(),
});

export async function GET() {
  const auth = await requireStaff();

  if (auth.error) {
    return auth.error;
  }

  try {
    const settings = await prisma.businessSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Could not load business settings:", error);

    return NextResponse.json(
      { error: "Could not load business settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

  const result = settingsSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid business settings.",
        details: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  const data = {
    businessName: result.data.businessName,
    address: result.data.address || null,
    phone: result.data.phone || null,
    email: result.data.email || null,
    receiptFooter: result.data.receiptFooter || null,
  };

  try {
    const settings = await prisma.businessSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Could not save business settings:", error);

    return NextResponse.json(
      { error: "Could not save business settings." },
      { status: 500 }
    );
  }
}
