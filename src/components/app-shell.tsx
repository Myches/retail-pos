"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { ToastProvider } from "@/components/ui/toast-provider";

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
    <ToastProvider>
      <div className="min-h-screen bg-[#f7f8fc] md:pl-[264px]">
        <AppSidebar />

        <main className="min-h-screen px-4 pb-8 pt-[76px] sm:px-6 md:px-8 md:pt-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}