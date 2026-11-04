
import { requireAdminPage } from "@/lib/page-auth";
import SettingsClient from "./settings-client";

export const instant = false;

export default async function SettingsPage() {
  await requireAdminPage();

  return <SettingsClient />;
}
