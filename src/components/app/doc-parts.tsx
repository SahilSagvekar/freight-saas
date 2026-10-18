import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import type { Party } from "@/lib/shipment";

export function DocToolbar({ backHref, backLabel, printLabel }: { backHref: string; backLabel: string; printLabel: string }) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{backLabel}</Link>
      <PrintButton label={printLabel} />
    </div>
  );
}

export function Letterhead({ company, title, number, sub }: { company: { name: string; address: string; phone: string; email: string; taxId: string }; title: string; number?: string; sub?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="text-sm">
        <p className="text-lg font-bold">{company.name}</p>
        {company.address && <p className="whitespace-pre-line text-muted">{company.address}</p>}
        <p className="text-muted">{[company.phone, company.email].filter(Boolean).join(" · ")}</p>
        {company.taxId && <p className="text-muted">Tax no. {company.taxId}</p>}
      </div>
      <div className="text-right">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{title}</h1>
        {number && <p className="font-mono text-lg font-semibold">{number}</p>}
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
    </header>
  );
}

/** A labelled box, the building block of a bill of lading. */
export function Box({ label, children, className = "" }: { label: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`border border-ink p-2 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function PartyBlock({ party }: { party: Party | null }) {
  if (!party || !party.name) return <span className="text-muted">—</span>;
  return (
    <>
      <p className="font-semibold">{party.name}</p>
      <p className="whitespace-pre-line">{party.address}</p>
      {(party.phone || party.email) && <p>{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
      {party.taxId && <p>Tax no. {party.taxId}</p>}
    </>
  );
}

export const DOC_SHEET = "mx-auto max-w-4xl rounded-lg border border-line-strong bg-white p-8 text-ink print:max-w-none print:rounded-none print:border-0 print:p-0";
