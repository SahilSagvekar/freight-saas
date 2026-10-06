"use client";

import { Anchor, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Menu, Settings, Store, Ticket, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

const ICONS = { dashboard: LayoutDashboard, voyages: CalendarDays, bookings: Ticket, review: ClipboardCheck, settings: Settings, desk: Store };

function Links({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Main">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-white/12 text-white" : "text-brand-200/80 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-[1.125rem]" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && <span className="rounded-full bg-warn-600 px-2 py-0.5 text-xs text-white">{item.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white"><Anchor className="size-4" aria-hidden /></span>
      <span className="truncate text-sm font-semibold text-white">{name}</span>
    </div>
  );
}

export function AppNav({
  items,
  tenantName,
  userName,
  roleName,
  logout,
}: {
  items: NavItem[];
  tenantName: string;
  userName: string;
  roleName: string;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const account = (
    <div className="border-t border-white/10 p-3">
      <div className="mb-2 px-1">
        <p className="truncate text-sm font-medium text-white">{userName}</p>
        <p className="truncate text-xs text-brand-300/70">{roleName}</p>
      </div>
      <form action={logout}>
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-brand-200/80 hover:bg-white/8 hover:text-white">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
  return (
    <>
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-900 py-5 lg:flex">
        <Brand name={tenantName} />
        <div className="mt-6 flex-1 overflow-y-auto px-3"><Links items={items} /></div>
        {account}
      </aside>

      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-navy-900 px-4 lg:hidden">
        <Brand name={tenantName} />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-white hover:bg-white/10">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-navy-900 py-5">
            <div className="flex items-center justify-between pr-3">
              <Brand name={tenantName} />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-white hover:bg-white/10"><X className="size-5" /></button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto px-3"><Links items={items} onNavigate={() => setOpen(false)} /></div>
            {account}
          </div>
        </div>
      )}
    </>
  );
}
