import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { APP_NAME } from "@/lib/utils";
import { getAuth } from "@/server/auth";
import { body, display } from "./_landing/fonts";
import { ManifestDemo } from "./_landing/manifest-demo";

export const metadata: Metadata = {
  title: { absolute: "Harborline — booking and manifests for ferry and freight operators" },
  description: "Sell passenger, vehicle and cargo tickets, even when the signal drops. One booking, one manifest, no spreadsheets.",
};

const ABILITIES = [
  { title: "People, vehicles and cargo together", body: "One booking can hold a family, their car and a pallet. Capacity is counted per sailing, per kind." },
  { title: "The manifest builds itself", body: "Every confirmed booking lands on the manifest. Dock crew tick items loaded and delivered from their phone." },
  { title: "QR tickets and fast boarding", body: "Print or send a ticket. Scan it at the gangway and the manifest updates on the spot." },
  { title: "End-of-day numbers in one click", body: "Sales by sailing and by cashier, unpaid invoices, refunds. Export to CSV for your accountant." },
];

const ROLES = ["Ticket desk", "Dock crew", "Cashier", "Manager", "Owner"];

const STEPS = [
  { title: "Set up in an afternoon", body: "Add your ports, vessels and prices. Invite your crew with a link." },
  { title: "Sell tickets", body: "At the desk, on a phone, or soon online. Payments are recorded against each booking." },
  { title: "Board and sail", body: "Scan tickets, mark items loaded, close the voyage. The day's report is waiting." },
];

const FAQ = [
  { q: "What if our internet drops at the ticket office?", a: "Keep selling. The desk stores bookings on the device and syncs them later. If two desks sold the last seats, the extras go to a review queue instead of being silently double-sold." },
  { q: "Is our data separate from other operators?", a: "Yes. Separation is enforced inside the database, not just in the app, so one operator can never read another's bookings." },
  { q: "Can we use our own currency and time zone?", a: "Yes. Each operator sets currency, locale and time zone, and \"today\" always means your day." },
  { q: "Can I cancel any time?", a: "Yes. Plans are monthly, and you can export your data whenever you like." },
];

const button = "inline-flex h-12 items-center justify-center rounded-md px-6 text-base font-medium transition-colors motion-reduce:transition-none";
const buttonSolid = `${button} bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950`;
const buttonOutline = `${button} border border-navy-900/35 text-ink hover:bg-white/70`;

const h2 = `${display.className} text-4xl font-semibold leading-[0.95] tracking-tight text-navy-900 sm:text-5xl`;

/** Three bars of different length: the capacity bars from the manifest, as a mark. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <rect x="2" y="4" width="20" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="10" width="14" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="16" width="8" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export default async function Home() {
  if (await getAuth()) redirect("/app");
  const demoUrl = process.env.DEMO_URL;
  const contact = process.env.CONTACT_EMAIL ?? "support@example.com";
  const demoHref = demoUrl ?? `mailto:${contact}?subject=Harborline%20demo`;
  const demoLabel = demoUrl ? "Try the live demo" : "Ask for a demo";

  return (
    <div className={`${body.className} bg-[#e9eeec] text-ink`}>
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className={`${display.className} flex items-center gap-2 text-3xl font-semibold tracking-tight text-navy-900`}>
            <Mark />
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <a href="#pricing" className="hidden text-muted hover:text-ink sm:block">Pricing</a>
            <a href="#faq" className="hidden text-muted hover:text-ink sm:block">FAQ</a>
            <Link href="/login" className="text-ink hover:underline">Sign in</Link>
            <Link href="/signup" className="hidden h-9 items-center rounded-md bg-navy-900 px-4 text-white hover:bg-navy-800 sm:inline-flex">Start free trial</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-start gap-14 px-6 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:pb-28 lg:pt-16">
        <div>
          <h1 className={`${display.className} text-[clamp(3.5rem,9vw,6.25rem)] font-semibold leading-[0.88] tracking-tight text-navy-900`}>
            Every passenger, vehicle and parcel on one manifest.
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-muted">
            Sell tickets at the dock, even with no signal. Know what&apos;s on every sailing, who has paid, and what was loaded, without a single spreadsheet.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonSolid}>Start your {TRIAL_DAYS}-day free trial</Link>
            <Link href={demoHref} className={buttonOutline}>{demoLabel}</Link>
          </div>
          <p className="mt-4 text-sm text-muted">No card needed to start. Set up in an afternoon.</p>
        </div>
        <ManifestDemo />
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={h2}>From sign-up to first sailing</h2>
          <ol className="mt-14 grid lg:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.title}
                className="relative border-l-2 border-navy-900 pb-10 pl-7 last:border-l-transparent last:pb-0 lg:border-l-0 lg:border-t-2 lg:pb-0 lg:pl-0 lg:pr-10 lg:pt-7 lg:last:border-t-transparent"
              >
                <span aria-hidden className="absolute -left-[9px] top-0 size-4 rounded-full border-2 border-navy-900 bg-white lg:-top-[9px] lg:left-0" />
                <h3 className={`${display.className} -mt-1 text-3xl font-semibold leading-tight text-navy-900 lg:mt-0`}>{s.title}</h3>
                <p className="mt-2 max-w-[28rem] text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-12 lg:py-28">
        <h2 className={`${h2} lg:col-span-4 lg:sticky lg:top-8 lg:self-start`}>Built for the dock, not the boardroom</h2>
        <div className="grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:col-span-8">
          {ABILITIES.map((a) => (
            <div key={a.title}>
              <h3 className={`${display.className} text-3xl font-semibold leading-tight text-navy-900`}>{a.title}</h3>
              <p className="mt-2 max-w-[30rem] text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className={h2}>A screen for each job</h2>
            <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-muted">
              Each person sees only what they need to do their job. You choose the permissions.
            </p>
          </div>
          <ul className="lg:col-span-7">
            {ROLES.map((r) => (
              <li key={r} className={`${display.className} text-5xl font-semibold leading-[1.05] tracking-tight text-navy-900 sm:text-6xl`}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20 lg:py-28">
        <h2 className={h2}>Simple monthly pricing</h2>
        <p className="mt-4 text-lg text-muted">{TRIAL_DAYS}-day free trial on every plan. Cancel any time.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:max-w-4xl">
          {PLANS.map((p, i) => {
            const featured = i === PLANS.length - 1;
            return (
              <div key={p.id} className={`rounded-lg bg-white p-7 ${featured ? "border-2 border-navy-900" : "border border-line-strong"}`}>
                <h3 className={`${display.className} text-3xl font-semibold text-navy-900`}>{p.name}</h3>
                <p className="text-muted">{p.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className={`${display.className} text-6xl font-semibold leading-none tracking-tight text-navy-900`}>${p.monthlyUsd}</span>
                  <span className="text-muted">a month</span>
                </p>
                <p className="mt-2 text-sm text-muted">
                  {p.maxVessels} {p.maxVessels === 1 ? "vessel" : "vessels"}, up to {p.maxUsers} people
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok-700" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/signup?plan=${p.id}`} className={`${featured ? buttonSolid : buttonOutline} mt-8 w-full`}>
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-muted">
          Bigger fleet?{" "}
          <a className="font-medium text-navy-900 underline underline-offset-4 hover:text-brand-700" href={`mailto:${contact}?subject=Harborline%20fleet`}>
            Talk to us
          </a>
          .
        </p>
      </section>

      <section id="faq" className="scroll-mt-8 bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
          <h2 className={`${h2} lg:col-span-4`}>Questions operators ask</h2>
          <div className="lg:col-span-8">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-line-strong py-5 last:border-b">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-muted transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="mt-3 max-w-[60ch] text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <h2 className={`${h2} max-w-[16ch]`}>Set up your first sailing this afternoon</h2>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonSolid}>Start your {TRIAL_DAYS}-day free trial</Link>
          <Link href={demoHref} className={buttonOutline}>{demoLabel}</Link>
        </div>
      </section>

      <footer className="border-t border-line-strong">
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
