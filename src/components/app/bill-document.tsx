import { Letterhead, PartyBlock, DOC_SHEET } from "@/components/app/doc-parts";
import { computeTotals, linesOf } from "@/lib/freight-billing";
import { formatMoney } from "@/lib/money";

type Doc = { customerName: string; customerCompany: string | null; customerEmail: string | null; customerAddress: string | null; lines: unknown; taxBp: number; currency: string; notes: string | null };

/** What a customer receives: used for both quotes and invoices. Totals are recomputed from the lines, so what prints always adds up. */
export function BillDocument({ title, number, sub, company, doc, meta, footer }: { title: string; number: string; sub?: string; company: { name: string; address: string; phone: string; email: string; taxId: string }; doc: Doc; meta: [string, string][]; footer?: string }) {
  const t = computeTotals(linesOf(doc.lines), doc.taxBp);
  return (
    <article className={DOC_SHEET}>
      <Letterhead company={company} title={title} number={number} sub={sub} />
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">For</p>
          <div className="mt-1 text-sm"><PartyBlock party={{ name: doc.customerCompany || doc.customerName, address: [doc.customerCompany ? doc.customerName : "", doc.customerAddress ?? ""].filter(Boolean).join("\n"), email: doc.customerEmail ?? "" }} /></div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:justify-self-end">
          {meta.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
        </dl>
      </div>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-y-2 border-ink text-left text-xs uppercase tracking-wide"><th className="py-2 pr-3">Description</th><th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>
          {t.lines.map((l, i) => (
            <tr key={i} className="border-b border-line align-top"><td className="py-1.5 pr-3">{l.description}</td><td className="py-1.5 pr-3 text-right">{l.quantity}</td><td className="py-1.5 pr-3 text-right">{formatMoney(l.unitPrice, doc.currency)}</td><td className="py-1.5 text-right">{formatMoney(l.amount, doc.currency)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto w-64 text-sm">
        <div className="flex justify-between py-0.5"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(t.subtotal, doc.currency)}</dd></div>
        {doc.taxBp > 0 && <div className="flex justify-between py-0.5"><dt className="text-muted">Tax ({doc.taxBp / 100}%)</dt><dd>{formatMoney(t.tax, doc.currency)}</dd></div>}
        <div className="flex justify-between border-t-2 border-ink py-1.5 text-base font-bold"><dt>Total</dt><dd>{formatMoney(t.total, doc.currency)}</dd></div>
      </dl>
      {doc.notes && <p className="mt-6 whitespace-pre-line text-sm">{doc.notes}</p>}
      {footer && <p className="mt-8 whitespace-pre-line border-t border-line pt-3 text-xs text-muted">{footer}</p>}
    </article>
  );
}
