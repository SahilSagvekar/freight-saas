"use client";

import { Anchor, Car, Minus, Package, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ITEM_KINDS, KIND_LABELS, type ItemKind } from "@/lib/domain";
import { formatDeparture } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { computeLine, resolveUnitPrice, sumLines } from "@/lib/pricing";
import type { CreateBookingInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/booking-actions";
import type { BookingFormData } from "@/server/queries";

type Line = { key: number; itemTypeId: string; quantity: number; attributes: Record<string, string | number | boolean> };
export type BookingSubmit = (input: CreateBookingInput) => Promise<ActionResult<{ bookingId?: string; bookingNo?: string; status?: string; reviewReason?: string | null; queued?: boolean }>>;

const KIND_ICON: Record<ItemKind, typeof Users> = { PASSENGER: Users, VEHICLE: Car, CARGO: Package };

/** Shared by the online page and the offline ticket desk: the caller decides how a finished booking is sent. */
export function BookingForm({
  data,
  currency,
  locale,
  submit,
  initialVoyageId,
  banner,
}: {
  data: BookingFormData;
  currency: string;
  locale: string;
  submit: BookingSubmit;
  initialVoyageId?: string;
  banner?: React.ReactNode;
}) {
  const [voyageId, setVoyageId] = useState(initialVoyageId ?? data.voyages[0]?.id ?? "");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ no?: string; status?: string; reason?: string | null; queued?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const voyage = data.voyages.find((v) => v.id === voyageId);
  const typeById = useMemo(() => new Map(data.itemTypes.map((t) => [t.id, t])), [data.itemTypes]);

  const priced = lines.map((l) => {
    const type = typeById.get(l.itemTypeId)!;
    const unitPrice = voyage ? resolveUnitPrice(data.priceRules, { itemTypeId: l.itemTypeId, originId: voyage.originId, destinationId: voyage.destinationId }) : null;
    const amounts = unitPrice === null ? null : computeLine({ unitPrice, quantity: l.quantity, kind: type.kind, taxRules: data.taxRules });
    return { line: l, type, unitPrice, amounts };
  });
  const totals = sumLines(priced.flatMap((p) => (p.amounts ? [p.amounts] : [])));
  const unpriced = priced.filter((p) => p.unitPrice === null);

  const adding = (itemTypeId: string) => {
    const existing = lines.find((l) => l.itemTypeId === itemTypeId && Object.keys(typeById.get(itemTypeId)!.fieldSchema).length === 0);
    if (existing) return setQty(existing.key, existing.quantity + 1);
    setLines((ls) => [...ls, { key: nextKey, itemTypeId, quantity: 1, attributes: {} }]);
    setNextKey((k) => k + 1);
  };
  const setQty = (key: number, quantity: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(999, quantity || 1)) } : l)));
  const setAttr = (key: number, field: string, value: string | number | boolean) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, attributes: { ...l.attributes, [field]: value } } : l)));
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  // Space this sale would use, so the agent sees a problem before the customer is standing at the desk.
  const wanted: Record<ItemKind, number> = { PASSENGER: 0, VEHICLE: 0, CARGO: 0 };
  for (const p of priced) wanted[p.type.kind] += p.type.capacityUnits * p.line.quantity;
  const shortOf = voyage ? ITEM_KINDS.filter((k) => wanted[k] > 0 && voyage.used[k] + wanted[k] > voyage.capacities[k]) : [];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!voyage) return setError("Choose a voyage first.");
    if (!contactName.trim()) return setError("Enter the customer's name.");
    if (lines.length === 0) return setError("Add at least one passenger, vehicle or cargo item.");
    if (unpriced.length) return setError(`No price is set for ${unpriced[0].type.name} on this route.`);
    start(async () => {
      const res = await submit({
        voyageId,
        contactName,
        contactPhone,
        notes,
        quotedTotal: totals.total,
        lines: lines.map((l) => ({ itemTypeId: l.itemTypeId, quantity: l.quantity, attributes: l.attributes })),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fields ?? {});
        return;
      }
      const d = res.data ?? {};
      setDone({ no: d.bookingNo, status: d.status, reason: d.reviewReason, queued: d.queued });
      if (d.bookingId && !d.queued) router.push(`/app/bookings/${d.bookingId}`);
    });
  }

  if (done?.queued) {
    return (
      <Card>
        <CardBody className="space-y-4 py-10 text-center">
          <Alert tone="success" title="Saved on this device">This sale will upload automatically as soon as you&apos;re back online.</Alert>
          <Button onClick={() => { setDone(null); setLines([]); setContactName(""); setContactPhone(""); setNotes(""); }}>Take another booking</Button>
        </CardBody>
      </Card>
    );
  }
  if (data.voyages.length === 0) return <Alert tone="warning" title="No voyages are open for booking">Schedule a voyage first, then come back.</Alert>;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {banner}
        <Card>
          <CardHeader title="1. Voyage" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Sailing" htmlFor="voyage" className="sm:col-span-2" required>
              <Select id="voyage" value={voyageId} onChange={(e) => setVoyageId(e.target.value)}>
                {data.voyages.map((v) => <option key={v.id} value={v.id}>{v.label} · {formatDeparture(new Date(v.departureAt))} · {v.vesselName}</option>)}
              </Select>
            </Field>
            <Field label="Customer name" htmlFor="name" required>
              <Input id="name" value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="off" placeholder="Full name" />
            </Field>
            <Field label="Phone" htmlFor="phone" hint="Optional">
              <Input id="phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 555 0100" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="2. What is travelling?" description="Tap an item to add it. Prices are for the sailing above." />
          <CardBody className="space-y-5">
            {ITEM_KINDS.map((kind) => {
              const types = data.itemTypes.filter((t) => t.kind === kind);
              if (!types.length) return null;
              const Icon = KIND_ICON[kind];
              return (
                <div key={kind}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Icon className="size-4" aria-hidden />{KIND_LABELS[kind]}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {types.map((t) => {
                      const price = voyage ? resolveUnitPrice(data.priceRules, { itemTypeId: t.id, originId: voyage.originId, destinationId: voyage.destinationId }) : null;
                      return (
                        <button key={t.id} type="button" disabled={price === null} onClick={() => adding(t.id)}
                          className="rounded-lg border border-line-strong bg-surface p-3 text-left transition hover:border-brand-400 hover:bg-brand-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                          <span className="block text-sm font-medium text-ink">{t.name}</span>
                          <span className="tabular text-sm text-muted">{price === null ? "No price" : formatMoney(price, currency, locale)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {lines.length > 0 && (
          <Card>
            <CardHeader title="Items in this booking" />
            <ul className="divide-y divide-line">
              {priced.map(({ line, type, unitPrice, amounts }) => (
                <li key={line.key} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{type.name}</p>
                      <p className="tabular text-xs text-muted">{unitPrice === null ? "No price on this route" : `${formatMoney(unitPrice, currency, locale)} each`}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" aria-label={`Fewer ${type.name}`} onClick={() => setQty(line.key, line.quantity - 1)}><Minus className="size-3.5" /></Button>
                      <Input aria-label={`${type.name} quantity`} inputMode="numeric" className="h-8 w-14 text-center" value={line.quantity} onChange={(e) => setQty(line.key, Number(e.target.value.replace(/\D/g, "")))} />
                      <Button size="sm" variant="secondary" aria-label={`More ${type.name}`} onClick={() => setQty(line.key, line.quantity + 1)}><Plus className="size-3.5" /></Button>
                    </div>
                    <p className="tabular w-24 text-right text-sm font-semibold">{amounts ? formatMoney(amounts.total, currency, locale) : "—"}</p>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${type.name}`} onClick={() => remove(line.key)}><Trash2 className="size-4" /></Button>
                  </div>
                  {type.fieldSchema.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {type.fieldSchema.map((f) => {
                        const id = `l${line.key}-${f.key}`;
                        const err = fieldErrors[`lines.${priced.findIndex((p) => p.line.key === line.key)}.${f.key}`];
                        if (f.type === "boolean") return <Checkbox key={f.key} label={f.label} checked={!!line.attributes[f.key]} onChange={(e) => setAttr(line.key, f.key, e.target.checked)} />;
                        return (
                          <Field key={f.key} label={f.label} htmlFor={id} required={f.required} error={err}>
                            {f.type === "select" ? (
                              <Select id={id} value={String(line.attributes[f.key] ?? "")} onChange={(e) => setAttr(line.key, f.key, e.target.value)}>
                                <option value="">Select…</option>
                                {f.options?.map((o) => <option key={o}>{o}</option>)}
                              </Select>
                            ) : (
                              <Input id={id} type={f.type === "number" ? "number" : "text"} aria-invalid={!!err} value={String(line.attributes[f.key] ?? "")} onChange={(e) => setAttr(line.key, f.key, f.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)} />
                            )}
                          </Field>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="3. Notes" description="Optional" />
          <CardBody><Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the crew should know" /></CardBody>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="Summary" />
          <CardBody className="space-y-4">
            {voyage && (
              <div className="rounded-lg bg-canvas p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Anchor className="size-4 text-brand-600" aria-hidden />{voyage.label}</p>
                <p className="mt-0.5 text-muted">{formatDeparture(new Date(voyage.departureAt))}</p>
                <dl className="mt-2 space-y-1">
                  {ITEM_KINDS.map((k) => {
                    const left = voyage.capacities[k] - voyage.used[k];
                    const over = wanted[k] > 0 && wanted[k] > left;
                    return (
                      <div key={k} className="flex justify-between"><dt className="text-muted">{KIND_LABELS[k]} space left</dt><dd className={cn("tabular font-medium", over && "text-danger-600")}>{left}{wanted[k] > 0 && <span className="text-subtle"> (need {wanted[k]})</span>}</dd></div>
                    );
                  })}
                </dl>
              </div>
            )}
            {shortOf.length > 0 && <Alert tone="warning">Not enough {shortOf.map((k) => KIND_LABELS[k].toLowerCase()).join(" or ")} space. {`The booking may be refused or sent for review.`}</Alert>}
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular">{formatMoney(totals.subtotal, currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tabular">{formatMoney(totals.taxAmount, currency, locale)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(totals.total, currency, locale)}</dd></div>
            </dl>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Saving…" : "Confirm booking"}</Button>
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
