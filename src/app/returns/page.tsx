import { requireAdminPage } from "@/lib/page-auth";
import ReturnsClient from "./returns-client";

export const instant = false;

export default async function ReturnsPage() {
  await requireAdminPage();

  return <ReturnsClient />;
}
