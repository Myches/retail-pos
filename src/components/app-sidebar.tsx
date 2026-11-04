"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/logout-button";

type StaffRole = "ADMIN" | "CASHIER";

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

const adminGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "WORKSPACE",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/checkout", label: "Checkout", icon: "checkout" },
    ],
  },
  {
    title: "INVENTORY",
    links: [
      { href: "/products", label: "Products", icon: "products" },
      { href: "/inventory", label: "Stock management", icon: "inventory" },
    ],
  },
  {
    title: "TRANSACTIONS",
    links: [
      { href: "/sales", label: "Sales history", icon: "sales" },
      { href: "/returns", label: "Returns", icon: "returns" },
    ],
  },
  {
    title: "ADMINISTRATION",
    links: [
      { href: "/admin/staff", label: "Staff management", icon: "staff" },
      { href: "/admin/settings", label: "Business settings", icon: "settings" },
      { href: "/admin/backups", label: "Backup & restore", icon: "backup" },
    ],
  },
];

const cashierGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "WORKSPACE",
    links: [
      { href: "/checkout", label: "Checkout", icon: "checkout" },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
    checkout: "M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6 M10 21h.01 M18 21h.01",
    products: "M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z M12 12l8-4.5 M12 12v9 M12 12 4 7.5",
    inventory: "M4 5h16v15H4z M8 5V3h8v2 M8 10h8 M8 14h5",
    sales: "M4 19V5 M4 19h17 M8 15l4-4 3 2 5-7",
    returns: "M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-2",
    staff: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8.2l-.1.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1l-.2.1-3.1-1.8.1-.2a1.7 1.7 0 0 0-.2-1.8l-.1-.1v-3.6l.2-.1a1.7 1.7 0 0 0 1-1.5l-.1-.2 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8-.2l.1-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1l.2-.1 3.1 1.8-.1.2a1.7 1.7 0 0 0 .2 1.8l.1.1z",
    backup: "M12 3v12 M7 10l5 5 5-5 M4 19v2h16v-2",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[19px] w-[19px] shrink-0"
    >
      <path d={paths[name] ?? paths.dashboard} />
    </svg>
  );
}

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

  useEffect(() => {
    if (!mobileOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  if (pathname === "/login" || !role) return null;

  const groups = role === "ADMIN" ? adminGroups : cashierGroups;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
        <span className="ml-3 text-sm font-bold tracking-tight text-slate-900">
          Retail POS
        </span>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white shadow-sm shadow-violet-200">
            R
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-slate-900">
              Retail POS
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Store management
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
          {groups.map((group) => (
            <section key={group.title}>
              <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.13em] text-slate-400">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                        active
                          ? "bg-violet-50 text-violet-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span className={active ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600"}>
                        <NavIcon name={link.icon} />
                      </span>
                      <span>{link.label}</span>
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-600" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              {role === "ADMIN" ? "A" : "C"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {role === "ADMIN" ? "Administrator" : "Cashier"}
              </p>
              <p className="text-xs text-slate-500">Signed in</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}