
import { requireAdminPage } from "@/lib/page-auth";
import StaffClient from "./staff-client";

export const instant = false;

export default async function StaffPage() {
  await requireAdminPage();

  return <StaffClient />;
}
