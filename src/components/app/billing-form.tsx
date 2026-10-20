"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { emptyBillLine, previewTotals, toInvoicePayload, toQuotePayload, type BillForm } from "@/lib/billing-form";
import { ModeChooser } from "@/components/app/mode-chooser";
import { formatMoney } from "@/lib/money";
import { PLACE_HINTS, isShipmentMode } from "@/lib/shipment";
import { saveInvoiceAction, saveQuoteAction } from "@/server/billing-doc-actions";

type Props = { kind: "quote" | "invoice"; initial: BillForm; docId: string | null; currency: string; links: { inquiryId?: string | null; shipmentId?: string | null; quoteId?: string | null } };

export function BillingFormView({ kind, initial, docId, currency, links }: Props) {
  const router = useRouter();
  const [f, setF] = useState<BillForm>(initial);
  const [nextKey, setNextKey] = useState(initial.lines.reduce((m, l) => Math.max(m, l.key), 0) + 1);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const quote = kind === "quote";
  const totals = previewTotals(f, currency);

  const text = (k: keyof BillForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setLine = (key: number, patch: Partial<BillForm["lines"][number]>) => setF((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { payload, errors: local } = quote ? toQuotePayload(f, currency, links.inquiryId ?? null) : toInvoicePayload(f, currency, { shipmentId: links.shipmentId ?? null, quoteId: links.quoteId ?? null });
    if (Object.keys(local).length) {
      setErrors(local);
      setError(Object.values(local)[0]!);
      return;
    }
    setErrors({});
    start(async () => {
      const res = quote ? await saveQuoteAction(docId, payload) : await saveInvoiceAction(docId, payload);
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fields ?? {});
        return;
      }
      router.push(`/app/${quote ? "quotes" : "invoices"}/${res.data?.id ?? docId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader title="Customer" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="b-name" required error={errors.customerName}><Input id="b-name" value={f.customerName} onChange={text("customerName")} maxLength={160} /></Field>
          <Field label="Company" htmlFor="b-company" error={errors.customerCompany}><Input id="b-company" value={f.customerCompany} onChange={text("customerCompany")} maxLength={160} /></Field>
          <Field label="Email" htmlFor="b-email" error={errors.customerEmail}><Input id="b-email" type="email" value={f.customerEmail} onChange={text("customerEmail")} maxLength={200} /></Field>
          <Field label="Address" htmlFor="b-addr" error={errors.customerAddress}><Textarea id="b-addr" rows={2} value={f.customerAddress} onChange={text("customerAddress")} maxLength={500} /></Field>
        </CardBody>
      </Card>

      {quote ? (
        <Card>
          <CardHeader title="The move" />
          <CardBody className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">How is it travelling? <span className="text-danger-600" aria-hidden>*</span></p>
              <ModeChooser id="q-mode" value={f.mode} onChange={(m) => setF((s) => ({ ...s, mode: m }))} error={errors.mode} />
            </div>
            {isShipmentMode(f.mode) && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="From" htmlFor="q-from" required hint={PLACE_HINTS[f.mode]} error={errors.origin}><Input id="q-from" value={f.origin} onChange={text("origin")} maxLength={160} /></Field>
                <Field label="To" htmlFor="q-to" required hint={PLACE_HINTS[f.mode]} error={errors.destination}><Input id="q-to" value={f.destination} onChange={text("destination")} maxLength={160} /></Field>
                <Field label="Valid until" htmlFor="q-valid" error={errors.validUntil}><Input id="q-valid" type="date" value={f.validUntil} onChange={text("validUntil")} /></Field>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Invoice details" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Invoice date" htmlFor="i-issued" required error={errors.issuedOn}><Input id="i-issued" type="date" value={f.issuedOn} onChange={text("issuedOn")} /></Field>
            <Field label="Due date" htmlFor="i-due" required error={errors.dueOn}><Input id="i-due" type="date" value={f.dueOn} onChange={text("dueOn")} /></Field>
            <Field label="Reference" htmlFor="i-ref" hint="Their PO, or your shipment number" error={errors.reference}><Input id="i-ref" value={f.reference} onChange={text("reference")} maxLength={120} /></Field>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Charges" description={`Prices in ${currency}.`} />
        <ul className="divide-y divide-line">
          {f.lines.map((l, i) => (
            <li key={l.key} className="grid gap-3 p-5 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-start">
              <Field label="Description" htmlFor={`l-${l.key}-d`} required error={errors[`lines.${i}.description`]}><Input id={`l-${l.key}-d`} value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} maxLength={200} placeholder="Freight, customs clearance, handling…" /></Field>
              <Field label="Qty" htmlFor={`l-${l.key}-q`} error={errors[`lines.${i}.quantity`]}><Input id={`l-${l.key}-q`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} /></Field>
              <Field label="Unit price" htmlFor={`l-${l.key}-p`} error={errors[`lines.${i}.unitPrice`]}><Input id={`l-${l.key}-p`} inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} /></Field>
              <Button type="button" size="sm" variant="ghost" className="sm:mt-6" aria-label={`Remove charge ${i + 1}`} disabled={f.lines.length === 1} onClick={() => setF((s) => ({ ...s, lines: s.lines.filter((x) => x.key !== l.key) }))}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <CardBody className="space-y-4 border-t border-line">
          <Button type="button" variant="secondary" onClick={() => { setF((s) => ({ ...s, lines: [...s.lines, emptyBillLine(nextKey)] })); setNextKey((k) => k + 1); }}><Plus className="size-4" aria-hidden />Add a charge</Button>
          {errors.lines && <p className="text-sm text-danger-600">{errors.lines}</p>}
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-end">
            <Field label="Tax rate (%)" htmlFor="b-tax" error={errors.taxBp}><Input id="b-tax" inputMode="decimal" value={f.taxPercent} onChange={text("taxPercent")} /></Field>
            <dl className="text-right text-sm" aria-live="polite">
              {totals ? (
                <>
                  <div className="flex justify-end gap-6"><dt className="text-muted">Subtotal</dt><dd className="w-32">{formatMoney(totals.subtotal, currency)}</dd></div>
                  <div className="flex justify-end gap-6"><dt className="text-muted">Tax</dt><dd className="w-32">{formatMoney(totals.tax, currency)}</dd></div>
                  <div className="flex justify-end gap-6 text-base font-semibold"><dt>Total</dt><dd className="w-32">{formatMoney(totals.total, currency)}</dd></div>
                </>
              ) : (
                <p className="text-muted">Fill in each charge to see the total.</p>
              )}
            </dl>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label={quote ? "Notes for the customer" : "Notes (printed on the invoice)"} htmlFor="b-notes" error={errors.notes}><Textarea id="b-notes" rows={3} value={f.notes} onChange={text("notes")} maxLength={2000} /></Field>
        </CardBody>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : docId ? "Save" : quote ? "Create quote" : "Create invoice"}</Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
