
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type StaffRole } from "@/lib/auth";

const usernameSchema = z.string().trim().min(3).max(50);
const passwordSchema = z.string().min(8).max(200);
const roleSchema = z.enum(["ADMIN", "CASHIER"]);

const createStaffSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema.default("CASHIER"),
});

const updateStaffSchema = z
  .object({
    id: z.string().min(1),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.isActive !== undefined ||
      data.password !== undefined,
    { message: "Provide at least one change." }
  );

const safeStaffSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sales: true,
    },
  },
} as const;

export async function GET() {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const staff = await prisma.staff.findMany({
      select: safeStaffSelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Could not load staff:", error);

    return NextResponse.json(
      { error: "Could not load staff." },
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

  const result = createStaffSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid staff details.",
        details: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(result.data.password, 12);

    const staff = await prisma.staff.create({
      data: {
        username: result.data.username,
        passwordHash,
        role: result.data.role,
      },
      select: safeStaffSelect,
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That username is already in use." },
        { status: 409 }
      );
    }

    console.error("Could not create staff account:", error);

    return NextResponse.json(
      { error: "Could not create staff account." },
      { status: 500 }
    );
  }
}

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

  const result = updateStaffSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid staff update.",
        details: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { id, role, isActive, password } = result.data;

  // Staff management cannot be used to change the current
  // administrator's own account.
  if (id === auth.staff.id) {
    return NextResponse.json(
      { error: "You cannot change your own account here." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : undefined;

    const staff = await prisma.$transaction(async (tx) => {
      const existing = await tx.staff.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new Error("STAFF_NOT_FOUND");
      }

      const nextRole = role ?? (existing.role as StaffRole);
      const nextIsActive = isActive ?? existing.isActive;

      // Never allow the last active administrator to lose
      // administrator access.
      const isRemovingAdmin =
        existing.role === "ADMIN" &&
        existing.isActive &&
        (nextRole !== "ADMIN" || !nextIsActive);

      if (isRemovingAdmin) {
        const activeAdminCount = await tx.staff.count({
          where: {
            role: "ADMIN",
            isActive: true,
          },
        });

        if (activeAdminCount <= 1) {
          throw new Error("LAST_ACTIVE_ADMIN");
        }
      }

      const updatedStaff = await tx.staff.update({
        where: { id },
        data: {
          ...(role !== undefined ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: safeStaffSelect,
      });

      // Revoke existing sessions when access or credentials change.
      if (
        (role !== undefined && role !== existing.role) ||
        (isActive === false && existing.isActive) ||
        passwordHash !== undefined
      ) {
        await tx.session.deleteMany({
          where: { staffId: id },
        });
      }

      return updatedStaff;
    });

    return NextResponse.json({ staff });
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_NOT_FOUND") {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      return NextResponse.json(
        {
          error: "You cannot remove or deactivate the last active administrator.",
        },
        { status: 409 }
      );
    }

    console.error("Could not update staff:", error);

    return NextResponse.json(
      { error: "Could not update staff account." },
      { status: 500 }
    );
  }
}
