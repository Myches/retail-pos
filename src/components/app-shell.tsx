
"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen md:pl-64">
      <AppSidebar />
      <main className="min-h-screen flex-1">
        {children}
      </main>
    </div>
  );
}
