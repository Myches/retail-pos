import { requireAdminPage } from "@/lib/page-auth";
import BackupsClient from "./backups-client";

export const instant = false;

export default async function BackupsPage() {
  await requireAdminPage();

  return <BackupsClient />;
}