"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CalendarRange,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ScrollText,
  Shield,
  Sun,
  Warehouse,
  X,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/cn";
import { buttonClass } from "./ui";

export type NavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "warehouses" | "inventory" | "jobs" | "calendar" | "transactions" | "reporting" | "master" | "events" | "admin";
  children?: { href: string; label: string }[];
};

const ICONS = {
  dashboard: LayoutDashboard,
  warehouses: Warehouse,
  inventory: Package,
  jobs: ClipboardList,
  calendar: CalendarRange,
  transactions: ArrowLeftRight,
  reporting: ClipboardList,
  master: Package,
  events: ScrollText,
  admin: Shield,
};

export function AppShell({
  user,
  nav,
  children,
}: {
  user: { name: string; roleName: string; scope: string };
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function applyTheme(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {open ? <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-sidebar text-sidebar-ink transition-all",
          collapsed ? "w-[4.5rem]" : "w-64",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center gap-3 px-3 py-4">
          <div className="grid h-10 w-10 shrink-0 grid-rows-3 overflow-hidden rounded-xl">
            <span className="bg-amber-700" />
            <span className="bg-stone-400" />
            <span className="bg-sky-900" />
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Workbook</p>
              <p className="truncate text-xs text-sidebar-muted">Endless Poxybilities</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname === item.href || pathname.startsWith(item.href + "/") || item.children?.some((child) => pathname.startsWith(child.href));
            return (
              <div key={item.href}>
                <Link
                  href={item.children?.[0]?.href ?? item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm",
                    active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white",
                  )}
                  title={item.label}
                >
                  <Icon size={18} />
                  {collapsed ? null : <span className="truncate">{item.label}</span>}
                </Link>
                {!collapsed && item.children ? (
                  <div className="ml-9 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-lg px-2 py-1.5 text-sm",
                          pathname === child.href ? "text-white" : "text-sidebar-muted hover:text-white",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <button
          className="m-2 hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-sidebar-muted hover:bg-white/5 lg:flex"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <ChevronLeft className={cn("transition", collapsed && "rotate-180")} size={18} />
          {collapsed ? null : "Collapse"}
        </button>
      </aside>
      <div className={cn("min-h-screen transition-all", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur">
          <button className={buttonClass("ghost")} type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
            <span className="lg:hidden">Menu</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className={buttonClass("ghost")} type="button" onClick={toggleTheme} aria-label="Toggle color theme">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted">{user.roleName} · {user.scope}</p>
            </div>
            <form action={logout}>
              <button className={buttonClass("outline")} type="submit">
                <LogOut size={16} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
            <button className="lg:hidden" type="button" onClick={() => setOpen(false)} aria-label="Dismiss">
              <X className="hidden" size={16} />
            </button>
          </div>
        </header>
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
