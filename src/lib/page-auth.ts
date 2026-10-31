
import { redirect } from "next/navigation";
import { getAuthenticatedStaff } from "@/lib/auth";

export async function requirePageStaff() {
  const staff = await getAuthenticatedStaff();

  if (!staff) {
    redirect("/login");
  }

  return staff;
}

export async function requireAdminPage() {
  const staff = await requirePageStaff();

  if (staff.role !== "ADMIN") {
    redirect("/checkout");
  }

  return staff;
}
