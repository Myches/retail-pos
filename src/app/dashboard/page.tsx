
import { requireAdminPage } from "@/lib/page-auth";
import DashboardClient from "./dashboard-client";

export const instant = false;

export default async function DashboardPage() {
  await requireAdminPage();

  return <DashboardClient />;
}
