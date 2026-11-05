"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, FileBarChart2, LayoutDashboard, LogOut, PhoneCall, Settings, BookMarked, IndianRupee, Users, DatabaseBackup, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type { Notification } from "@/lib/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LABELS } from "@/lib/types";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/enquiries", label: "Enquiries", icon: PhoneCall },
  { href: "/bookings", label: "Bookings", icon: BookMarked },
  { href: "/payments", label: "Payments", icon: IndianRupee, roles: ["admin", "accounts"] },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/backup", label: "Backup", icon: DatabaseBackup, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Shell({ profile, orgName, notifications, children }: { profile: Profile; orgName: string; notifications: Notification[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || n.roles.includes(profile.role));
  const mobileItems = items.filter((n) => ["/dashboard", "/calendar", "/enquiries", "/bookings"].includes(n.href));

  const navLinks = (onClick?: () => void) =>
    items.map((n) => {
      const active = pathname === n.href || pathname.startsWith(n.href + "/");
      return (
        <Link
          key={n.href}
          href={n.href}
          onClick={onClick}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors",
            active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <n.icon className="size-[18px]" />
          {n.label}
        </Link>
      );
    });

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-white">
            <svg viewBox="0 0 64 64" className="size-6" fill="currentColor"><path d="M14 46V28l18-12 18 12v18H38V34H26v12z" /></svg>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{orgName}</div>
            <div className="text-xs text-muted">Hall booking</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">{navLinks()}</nav>
        <div className="border-t border-line p-3 text-xs text-muted">
          Signed in as <span className="font-medium text-ink">{profile.full_name}</span>
          <br />
          {LABELS.role[profile.role]}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur lg:px-6">
          <button className="rounded-md p-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold lg:hidden">{orgName}</div>
          <div className="hidden flex-1 lg:block" />

          <DropdownMenu>
            <DropdownMenuTrigger className="relative rounded-md p-2 hover:bg-surface-2 cursor-pointer" aria-label="Notifications">
              <Bell className="size-5" />
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
              <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-ink">Needs attention</DropdownMenuLabel>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nothing pending. Good work.</p>}
                {notifications.map((n, i) => (
                  <DropdownMenuItem key={i} asChild>
                    <Link href={n.href} className="flex flex-col items-start gap-0.5 border-t border-line px-3 py-2">
                      <span className={cn("text-[13px] font-medium", n.level === "danger" ? "text-danger" : n.level === "warn" ? "text-warn" : "text-ink")}>{n.title}</span>
                      <span className="text-xs text-muted">{n.detail}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2 cursor-pointer">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {profile.full_name.slice(0, 1).toUpperCase()}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="text-sm font-medium text-ink">{profile.full_name}</div>
                <div>{profile.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full"><LogOut /> Sign out</button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-3 py-4 pb-24 lg:px-6 lg:py-6 lg:pb-8">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {mobileItems.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
                <n.icon className="size-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-y-0 left-0 w-64 bg-surface p-3 shadow-xl animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 px-3 py-2 text-sm font-semibold">{orgName}</div>
            <nav className="space-y-0.5">{navLinks(() => setOpen(false))}</nav>
          </div>
        </div>
      )}
    </div>
  );
}
