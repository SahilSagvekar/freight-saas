import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/utils";
import { getAuth } from "@/server/auth";
import { body, display } from "./_landing/fonts";
import { FreightDemo } from "./_landing/freight-demo";
import { MiniBol, MiniInvoice, MiniLabel, MiniPackingList } from "./_landing/mini-docs";

export const metadata: Metadata = {
  title: { absolute: "Harborline · freight forwarding software for small teams" },
  description: "Take a freight job from website inquiry to quote, shipment, Bill of Lading, cargo labels, tracking and invoice. Type it once.",
};

const FLOW = [
  { title: "Inquiry", team: "Lands in your inbox from the form on your website.", customer: "Fills in route, cargo and weight." },
  { title: "Quote", team: "Built from the inquiry: charges, tax, valid-until date.", customer: "Gets a clear price to accept." },
  { title: "Shipment", team: "The accepted quote becomes the job: parties, packages, container.", customer: "Hands over the cargo." },
  { title: "Tracking", team: "Picked up, in transit, arrived, cleared, delivered.", customer: "Follows a link, or scans the label." },
  { title: "Invoice", team: "Made from the shipment, then marked paid.", customer: "Gets the invoice with a due date." },
];

const DOCS = [
  { name: "Bill of Lading", note: "Becomes a House Air Waybill by air and a Road Consignment Note by road. Carries your own terms.", Doc: MiniBol },
  { name: "Packing list", note: "Pieces, sizes, gross weight and cubic metres, totalled for you.", Doc: MiniPackingList },
  { name: "Commercial invoice", note: "HS codes and declared values, ready for customs.", Doc: MiniInvoice },
  { name: "Cargo labels", note: "100 × 150 mm, one per piece, numbered and QR-coded.", Doc: MiniLabel },
];

const MODES = [
  { mode: "Ocean", detail: "House and master B/L numbers, container and seal, cubic metres per line." },
  { mode: "Air", detail: "HAWB and MAWB, and chargeable weight worked out at 167 kg per m³." },
  { mode: "Road", detail: "A consignment note for door-to-door jobs, with the same labels and tracking." },
];

const COMPARE = [
  { q: "Time to get started", suite: "Often weeks of setup and training", sheets: "Today", us: "An afternoon" },
  { q: "Typing per job", suite: "Once, across many screens", sheets: "Again for every document", us: "Once" },
  { q: "Customer tracking", suite: "Usually an extra module", sheets: "Phone calls and emails", us: "A link and a QR code" },
  { q: "Cost", suite: "Priced for large forwarders", sheets: "Free, plus your hours", us: "Free during the pilot" },
];

const FAQ = [
  { q: "Can we use our own wording on the Bill of Lading?", a: "Yes. Your company details and legal terms are set once in Settings and printed on every document." },
  { q: "Does it file customs declarations?", a: "No. It produces the commercial invoice and packing list with HS codes and values, which you then use with your customs broker or system." },
  { q: "Is our data kept separate from other companies?", a: "Yes. Separation is enforced inside the database itself, not just in the app, so one company can never see another's shipments." },
  { q: "Can we bring in our existing jobs, and get our data out?", a: "Yes. Import shipments from a spreadsheet, and export shipments and inquiries to CSV whenever you like." },
  { q: "Does it work with our currency and time zone?", a: "Yes. Each company sets its own currency and time zone when it signs up." },
  { q: "What happens after the pilot?", a: "You aren't charged during the pilot. Before it ends we agree a price with you, and nothing is charged without your OK." },
];

const solid = "inline-flex h-12 items-center justify-center rounded-md bg-navy-900 px-6 text-base font-medium text-white transition-colors hover:bg-navy-800 active:bg-navy-950 motion-reduce:transition-none";
const outline = "inline-flex h-12 items-center justify-center rounded-md border border-navy-900/30 px-6 text-base font-medium text-navy-900 transition-colors hover:bg-white/70 motion-reduce:transition-none";
const h2 = `${display.className} text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[0.95] tracking-tight text-navy-900 text-balance`;
const eyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-[#b8471a]";

/** A shipping carton with its label: the mark. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="14.5" y="13" width="4" height="3" rx="0.5" fill="#f2733f" transform="rotate(-27 16.5 14.5)" />
    </svg>
  );
}

export default async function Home() {
  if (await getAuth()) redirect("/app");
  const contact = process.env.CONTACT_EMAIL ?? "support@example.com";
  const talk = `mailto:${contact}?subject=Harborline%20pilot`;

  return (
    <div className={`${body.className} bg-[#eef1ee] text-navy-900`}>
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className={`${display.className} flex items-center gap-2 text-3xl font-semibold tracking-tight`}>
            <Mark />
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <a href="#how" className="hidden text-muted hover:text-navy-900 md:block">How it works</a>
            <a href="#documents" className="hidden text-muted hover:text-navy-900 md:block">Documents</a>
            <a href="#faq" className="hidden text-muted hover:text-navy-900 md:block">FAQ</a>
            <Link href="/login" className="hover:underline">Sign in</Link>
            <Link href="/signup" className="hidden h-9 items-center rounded-md bg-navy-900 px-4 text-white hover:bg-navy-800 sm:inline-flex">Join the free pilot</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:pb-28 lg:pt-14">
        <div className="min-w-0">
          <p className={eyebrow}>For freight forwarders · air, ocean and road</p>
          <h1 className={`${display.className} mt-4 text-[clamp(3.25rem,8vw,5.75rem)] font-semibold leading-[0.88] tracking-tight text-balance`}>
            Type the job once. Every document follows.
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-muted">
            From the inquiry on your website to the quote, the Bill of Lading, the cargo labels and the paid invoice, without copying a field between Word, Excel and email.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className={solid}>Join the free pilot</Link>
            <a href="#how" className={outline}>See how it works</a>
          </div>
          <p className="mt-4 text-sm text-muted">Free while we build it with our first forwarders. No card needed.</p>
        </div>
        <FreightDemo />
      </section>

      <section id="how" className="scroll-mt-8 bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <p className={eyebrow}>How a job moves</p>
          <h2 className={`${h2} mt-3 max-w-[18ch]`}>Five steps, one record, from first email to paid.</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-5 md:gap-0">
            {FLOW.map((s, i) => (
              <li key={s.title} className="relative md:pr-6">
                <div className="flex items-center gap-3 md:block">
                  <span className={`${display.className} flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-navy-900 bg-white text-lg font-semibold`}>{i + 1}</span>
                  {i < FLOW.length - 1 && <span aria-hidden className="absolute left-10 right-0 top-5 hidden h-0.5 bg-navy-900/80 md:block" />}
                  <h3 className={`${display.className} text-3xl font-semibold leading-none md:mt-5`}>{s.title}</h3>
                </div>
                <p className="mt-3 text-[15px] leading-snug">{s.team}</p>
                <p className="mt-2 text-sm leading-snug text-muted"><span className="font-medium text-[#b8471a]">Customer:</span> {s.customer}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="documents" className="scroll-mt-8 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className={eyebrow}>The paperwork</p>
              <h2 className={`${h2} mt-3`}>Four documents from one shipment.</h2>
            </div>
            <p className="max-w-[34rem] text-lg leading-relaxed text-muted lg:col-span-5">
              Enter the shipper, consignee and packages once. The paperwork fills itself in, and prints or saves as a PDF.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {DOCS.map(({ name, note, Doc }) => (
              <figure key={name} className="flex min-w-0 flex-col">
                <div className="flex aspect-[210/297] items-end justify-center">
                  <Doc className={name === "Cargo labels" ? "w-[72%]" : "w-full"} />
                </div>
                <figcaption className="mt-5">
                  <p className={`${display.className} text-2xl font-semibold leading-none`}>{name}</p>
                  <p className="mt-2 text-sm leading-snug text-muted">{note}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className={eyebrow}>Every mode</p>
            <h2 className={`${h2} mt-3`}>Air, ocean and road in one place.</h2>
          </div>
          <dl className="divide-y divide-navy-900/15 border-y border-navy-900/15 lg:col-span-8">
            {MODES.map((m) => (
              <div key={m.mode} className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr] sm:items-baseline">
                <dt className={`${display.className} text-4xl font-semibold leading-none`}>{m.mode}</dt>
                <dd className="text-lg leading-relaxed text-muted">{m.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <p className={eyebrow}>Who it is for</p>
          <h2 className={`${h2} mt-3 max-w-[20ch]`}>Built for teams of 2 to 20, not enterprise budgets.</h2>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-navy-900 text-sm">
                  <th className="py-3 pr-4 font-medium text-muted" scope="col"><span className="sr-only">Question</span></th>
                  <th className="py-3 pr-4 font-medium text-muted" scope="col">Enterprise forwarding suites</th>
                  <th className="py-3 pr-4 font-medium text-muted" scope="col">Spreadsheets and templates</th>
                  <th className={`${display.className} py-3 text-xl font-semibold`} scope="col">{APP_NAME}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.q} className="border-b border-navy-900/15">
                    <th className="py-4 pr-4 font-medium" scope="row">{r.q}</th>
                    <td className="py-4 pr-4 text-muted">{r.suite}</td>
                    <td className="py-4 pr-4 text-muted">{r.sheets}</td>
                    <td className="py-4 font-semibold"><span className="border-b-2 border-[#f2733f]">{r.us}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pilot" className="bg-navy-900 py-20 text-white lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f7a07b]">The pilot</p>
            <h2 className={`${display.className} mt-3 text-[clamp(2.5rem,5.5vw,4rem)] font-semibold leading-[0.92] tracking-tight text-balance`}>
              We are onboarding a small group of forwarders, free.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-6">
            <div>
              <p className={`${display.className} text-2xl font-semibold`}>You get</p>
              <ul className="mt-3 space-y-2 text-white/80">
                <li>The full product, free during the pilot</li>
                <li>Setup done with you, on a call</li>
                <li>A direct line to the person building it</li>
              </ul>
            </div>
            <div>
              <p className={`${display.className} text-2xl font-semibold`}>We ask</p>
              <ul className="mt-3 space-y-2 text-white/80">
                <li>Run real shipments through it</li>
                <li>A short feedback call every two weeks</li>
                <li>Tell us what is missing</li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-md bg-white px-6 text-base font-medium text-navy-900 transition-colors hover:bg-white/90 motion-reduce:transition-none">Join the free pilot</Link>
              <a href={talk} className="inline-flex h-12 items-center justify-center rounded-md border border-white/35 px-6 text-base font-medium text-white transition-colors hover:bg-white/10 motion-reduce:transition-none">Email us first</a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-8 py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
          <h2 className={`${h2} lg:col-span-4`}>Questions forwarders ask</h2>
          <div className="lg:col-span-8">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-t border-navy-900/20 py-5 last:border-b">
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

      <footer className="border-t border-navy-900/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <span className="flex gap-5">
            <Link href="/terms" className="hover:text-navy-900">Terms</Link>
            <Link href="/privacy" className="hover:text-navy-900">Privacy</Link>
            <a href={`mailto:${contact}`} className="hover:text-navy-900">{contact}</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
