import { requireAdminPage } from "@/lib/page-auth";
import ProductsClient from "./products-client";

export const instant = false;

export default async function ProductsPage() {
  await requireAdminPage();

  return <ProductsClient />;
}
