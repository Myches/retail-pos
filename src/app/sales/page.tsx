import { requireAdminPage } from "@/lib/page-auth";
import SalesClient from "./sales-client";

export const instant = false;

export default async function SalesPage() {
  await requireAdminPage();

  return <SalesClient />;
}
