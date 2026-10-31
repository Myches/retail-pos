import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "retailpos_session";
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export type StaffRole = "ADMIN" | "CASHIER";

export type AuthenticatedStaff = {
  id: string;
  username: string;
  role: StaffRole;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAuthenticatedStaff(): Promise<AuthenticatedStaff | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(token),
    },
    select: {
      id: true,
      expiresAt: true,
      staff: {
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date() || !session.staff.isActive) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });

    return null;
  }

  if (
    session.staff.role !== "ADMIN" &&
    session.staff.role !== "CASHIER"
  ) {
    return null;
  }

  return {
    id: session.staff.id,
    username: session.staff.username,
    role: session.staff.role,
  };
}

export async function requireStaff(): Promise<
  | { staff: AuthenticatedStaff; error?: never }
  | { staff?: never; error: Response }
> {
  const staff = await getAuthenticatedStaff();

  if (!staff) {
    return {
      error: Response.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  return { staff };
}

export async function requireAdmin(): Promise<
  | { staff: AuthenticatedStaff; error?: never }
  | { staff?: never; error: Response }
> {
  const result = await requireStaff();

  if (result.error) {
    return result;
  }

  if (result.staff.role !== "ADMIN") {
    return {
      error: Response.json(
        { error: "Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return result;
}
