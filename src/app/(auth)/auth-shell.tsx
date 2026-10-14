import { Anchor } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/utils";

/** The two-panel layout shared by the sign-in and set-password pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_28rem]">
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500"><Anchor className="size-5" aria-hidden /></span>
          {APP_NAME}
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Passengers, vehicles and cargo — one booking, one manifest.</h2>
          <p className="mt-4 text-brand-200">Sell at the ticket desk even when the signal drops. Everything syncs when you&apos;re back online.</p>
        </div>
        <p className="text-sm text-brand-300/70">Built for ferry and freight operators.</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[28rem] rounded-full bg-brand-500/15" />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
