
import { requireAdminPage } from "@/lib/page-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

  return <>{children}</>;
}
