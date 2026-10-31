import { requireAdminPage } from "@/lib/page-auth";
import InventoryClient from "./inventory-client";

export const instant = false;

export default async function InventoryPage() {
  await requireAdminPage();

  return <InventoryClient />;
}
