
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/logout-button";

type StaffRole = "ADMIN" | "CASHIER";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/checkout", label: "Checkout" },
  { href: "/products", label: "Products" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales history" },
  { href: "/returns", label: "Returns" },
];

const cashierLinks = [
  { href: "/checkout", label: "Checkout" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setRole(null);
      return;
    }

    let cancelled = false;

    async function loadStaff() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setRole(null);
          return;
        }

        const data = await response.json();
        const staffRole = data?.staff?.role;

        if (
          !cancelled &&
          (staffRole === "ADMIN" || staffRole === "CASHIER")
        ) {
          setRole(staffRole);
        }
      } catch {
        if (!cancelled) setRole(null);
      }
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/login" || !role) return null;

  const links = role === "ADMIN" ? adminLinks : cashierLinks;

  return (
    <>
      <button
        type="button"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow md:hidden"
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-slate-100 transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-6 py-6">
          <p className="text-lg font-bold tracking-wide">Retail POS</p>
          <p className="mt-1 text-sm text-slate-400">
            {role === "ADMIN" ? "Administrator" : "Cashier"}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
