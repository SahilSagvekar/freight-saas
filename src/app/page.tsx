import { Anchor, Check, CloudOff, FileText, QrCode, ScanLine, Ship, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { APP_NAME } from "@/lib/utils";
import { getAuth } from "@/server/auth";

export const metadata: Metadata = {
  title: { absolute: "Harborline — booking and manifests for ferry and freight operators" },
  description: "Sell passenger, vehicle and cargo tickets, even when the signal drops. One booking, one manifest, no spreadsheets.",
};

const FEATURES = [
  { icon: CloudOff, title: "Works when the signal doesn't", body: "The ticket desk keeps selling offline. Everything syncs when you're back, and nothing is oversold without a human checking." },
  { icon: Ship, title: "People, vehicles and cargo together", body: "One booking can hold a family, their car and a pallet. Capacity is counted per sailing, per kind." },
  { icon: FileText, title: "The manifest builds itself", body: "Every confirmed booking lands on the manifest. Dock crew tick items loaded and delivered from their phone." },
  { icon: QrCode, title: "QR tickets and fast boarding", body: "Print or send a ticket. Scan it at the gangway and the manifest updates on the spot." },
  { icon: Users, title: "A screen for each job", body: "Ticket desk, dock crew, cashier, manager and owner each see only what they need. You choose the permissions." },
  { icon: ScanLine, title: "End-of-day numbers in one click", body: "Sales by sailing and by cashier, unpaid invoices, refunds. Export to CSV for your accountant." },
];

const STEPS = [
  { n: "1", title: "Set up in an afternoon", body: "Add your ports, vessels and prices. Invite your crew with a link." },
  { n: "2", title: "Sell tickets", body: "At the desk, on a phone, or soon online. Payments are recorded against each booking." },
  { n: "3", title: "Board and sail", body: "Scan tickets, mark items loaded, close the voyage. The day's report is waiting." },
];

const FAQ = [
  { q: "What if our internet drops at the ticket office?", a: "Keep selling. The desk stores bookings on the device and syncs them later. If two desks sold the last seats, the extras go to a review queue instead of being silently double-sold." },
  { q: "Is our data separate from other operators?", a: "Yes. Separation is enforced inside the database, not just in the app, so one operator can never read another's bookings." },
  { q: "Can we use our own currency and time zone?", a: "Yes. Each operator sets currency, locale and time zone, and \"today\" always means your day." },
  { q: "Can I cancel any time?", a: "Yes. Plans are monthly, and you can export your data whenever you like." },
];

export default async function Home() {
  if (await getAuth()) redirect("/app");
  const demoUrl = process.env.DEMO_URL;
  const contact = process.env.CONTACT_EMAIL ?? "support@example.com";

  return (
    <div className="bg-surface">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-white">
          <span className="flex items-center gap-2.5 text-lg font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500"><Anchor className="size-5" aria-hidden /></span>
            {APP_NAME}
          </span>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#pricing" className="hidden text-brand-100 hover:text-white sm:block">Pricing</a>
            <a href="#faq" className="hidden text-brand-100 hover:text-white sm:block">FAQ</a>
            <Link href="/login" className="font-medium hover:underline">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy-900 pb-28 pt-36 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-brand-500/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-56 left-1/3 size-[40rem] rounded-full bg-brand-400/10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-brand-100">For ferry and freight operators</p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Every passenger, vehicle and parcel on one manifest.</h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">Sell tickets at the dock, even with no signal. Know what&apos;s on every sailing, who has paid, and what was loaded, without a single spreadsheet.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">Start your {TRIAL_DAYS}-day free trial</ButtonLink>
              {demoUrl ? (
                <ButtonLink href={demoUrl} size="lg" variant="secondary">Try the live demo</ButtonLink>
              ) : (
                <ButtonLink href={`mailto:${contact}?subject=Harborline%20demo`} size="lg" variant="secondary">Ask for a demo</ButtonLink>
              )}
            </div>
            <p className="mt-4 text-sm text-brand-200/80">No card needed to start. Set up in an afternoon.</p>
          </div>

          <div aria-hidden className="rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-pop">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Today 07:30</p>
                <p className="text-lg font-semibold">Harbour Town → Palm Island</p>
              </div>
              <span className="rounded-full bg-warn-100 px-2.5 py-1 text-xs font-medium text-warn-700">Boarding</span>
            </div>
            <div className="mt-4 space-y-3">
              {[["Passengers", 88, "88 / 120"], ["Vehicles", 71, "13 / 18"], ["Cargo", 45, "18 / 40"]].map(([label, pct, text]) => (
                <div key={String(label)}>
                  <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-muted">{text}</span></div>
                  <div className="h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-5 divide-y divide-line rounded-lg border border-line text-sm">
              {[["2 × Adult · 1 × Car", "Loaded"], ["1 × Pallet — fish crates", "Waiting"], ["4 × Adult", "Loaded"]].map(([item, status]) => (
                <div key={item} className="flex items-center justify-between px-3 py-2.5"><span>{item}</span><span className={status === "Loaded" ? "text-ok-700" : "text-muted"}>{status}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">Built for the dock, not the boardroom</h2>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-canvas py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-semibold tracking-tight">From sign-up to first sailing</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-line bg-surface p-6 shadow-card">
                <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Simple monthly pricing</h2>
        <p className="mt-2 text-muted">{TRIAL_DAYS}-day free trial on every plan. Cancel any time.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:max-w-4xl">
          {PLANS.map((p, i) => (
            <div key={p.id} className={`rounded-2xl border p-7 ${i === 1 ? "border-brand-500 shadow-pop" : "border-line shadow-card"}`}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="text-sm text-muted">{p.tagline}</p>
              <p className="mt-5"><span className="text-4xl font-semibold tracking-tight">${p.monthlyUsd}</span><span className="text-muted"> / month</span></p>
              <p className="mt-1 text-sm text-muted">{p.maxVessels} {p.maxVessels === 1 ? "vessel" : "vessels"} · up to {p.maxUsers} people</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-ok-700" aria-hidden />{f}</li>)}
              </ul>
              <ButtonLink href={`/signup?plan=${p.id}`} variant={i === 1 ? "primary" : "secondary"} className="mt-7 w-full">Start free trial</ButtonLink>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">Bigger fleet? <a className="font-medium text-brand-700 hover:underline" href={`mailto:${contact}?subject=Harborline%20fleet`}>Talk to us</a>.</p>
      </section>

      <section id="faq" className="bg-canvas py-20">
        <div className="mx-auto max-w-3xl scroll-mt-8 px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions operators ask</h2>
          <div className="mt-8 divide-y divide-line rounded-xl border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary>
                <p className="mt-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <span className="flex gap-5">
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <a href={`mailto:${contact}`} className="hover:text-ink">Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
