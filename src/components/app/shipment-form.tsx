"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { emptyPackage, toShipmentPayload, type PackageForm, type PartyForm, type ShipmentForm } from "@/lib/shipment-form";
import { INCOTERMS, PACKAGE_TYPES, PLACE_HINTS, TRANSPORT_FIELDS, isShipmentMode, type ShipmentMode, type TransportFieldKey } from "@/lib/shipment";
import { ModeChooser } from "@/components/app/mode-chooser";
import { saveShipmentAction } from "@/server/shipment-actions";

function PartyFields({ id, title, hint, value, onChange, errors, required }: { id: string; title: string; hint?: string; value: PartyForm; onChange: (p: PartyForm) => void; errors: Record<string, string>; required: boolean }) {
  const set = (k: keyof PartyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      <Field label="Name" htmlFor={`${id}-name`} required={required} error={errors[`${id}.name`]}><Input id={`${id}-name`} value={value.name} onChange={set("name")} maxLength={160} /></Field>
      <Field label="Address" htmlFor={`${id}-address`} required={required} error={errors[`${id}.address`]}><Textarea id={`${id}-address`} rows={3} value={value.address} onChange={set("address")} maxLength={500} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone" htmlFor={`${id}-phone`} error={errors[`${id}.phone`]}><Input id={`${id}-phone`} value={value.phone} onChange={set("phone")} maxLength={60} /></Field>
        <Field label="Email" htmlFor={`${id}-email`} error={errors[`${id}.email`]} hint="Used for tracking updates."><Input id={`${id}-email`} type="email" value={value.email} onChange={set("email")} maxLength={200} /></Field>
      </div>
      <Field label="Tax or registration no." htmlFor={`${id}-tax`} error={errors[`${id}.taxId`]}><Input id={`${id}-tax`} value={value.taxId} onChange={set("taxId")} maxLength={60} /></Field>
    </fieldset>
  );
}

const TRANSPORT_ORDER: TransportFieldKey[] = ["carrier", "vesselOrFlight", "voyageNo", "masterNo", "houseNo", "containerNo", "sealNo"];
const MAX_LEN: Record<TransportFieldKey, number> = { carrier: 120, vesselOrFlight: 120, voyageNo: 60, masterNo: 60, houseNo: 60, containerNo: 60, sealNo: 60 };

export function ShipmentFormView({ initial, shipmentId, currency }: { initial: ShipmentForm; shipmentId: string | null; currency: string }) {
  const router = useRouter();
  const [f, setF] = useState<ShipmentForm>(initial);
  const [nextKey, setNextKey] = useState(initial.packages.reduce((m, p) => Math.max(m, p.key), 0) + 1);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const text = (k: keyof ShipmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const mode: ShipmentMode | null = isShipmentMode(f.mode) ? f.mode : null;
  // Changing the mode drops transport details that don't apply to the new one, so a stale container no. can't ride along on an air job.
  const chooseMode = (m: ShipmentMode) =>
    setF((s) => {
      const keep = TRANSPORT_FIELDS[m];
      const cleared = Object.fromEntries(TRANSPORT_ORDER.filter((k) => !keep[k]).map((k) => [k, ""]));
      return { ...s, ...cleared, mode: m };
    });
  const setPkg = (key: number, patch: Partial<PackageForm>) => setF((s) => ({ ...s, packages: s.packages.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const addPkg = () => {
    setF((s) => ({ ...s, packages: [...s.packages, emptyPackage(nextKey)] }));
    setNextKey((k) => k + 1);
  };
  const removePkg = (key: number) => setF((s) => ({ ...s, packages: s.packages.length > 1 ? s.packages.filter((p) => p.key !== key) : s.packages }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { payload, errors: local } = toShipmentPayload(f, currency);
    if (Object.keys(local).length) {
      setErrors(local);
      setError(Object.values(local)[0]!);
      return;
    }
    setErrors({});
    start(async () => {
      const res = await saveShipmentAction(shipmentId, payload);
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fields ?? {});
        return;
      }
      router.push(`/app/shipments/${res.data?.id ?? shipmentId}`);
      router.refresh();
    });
  }

  const pkgError = (i: number, k: string) => errors[`packages.${i}.${k}`];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader title="1. The shipment" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-ink" id="sh-mode-label">How is it travelling? <span className="text-danger-600" aria-hidden>*</span></p>
            <ModeChooser id="sh-mode" value={f.mode} onChange={chooseMode} error={errors.mode} />
            {!mode && !errors.mode && <p className="mt-1.5 text-xs text-muted">Choose one to see the right fields and documents.</p>}
          </div>
          {mode && <>
          <Field label="Customer reference" htmlFor="sh-ref" hint="Their PO or job number" error={errors.customerRef}><Input id="sh-ref" value={f.customerRef} onChange={text("customerRef")} maxLength={80} /></Field>
          <Field label="From" htmlFor="sh-origin" required hint={PLACE_HINTS[mode]} error={errors.origin}><Input id="sh-origin" value={f.origin} onChange={text("origin")} maxLength={160} /></Field>
          <Field label="To" htmlFor="sh-dest" required hint={PLACE_HINTS[mode]} error={errors.destination}><Input id="sh-dest" value={f.destination} onChange={text("destination")} maxLength={160} /></Field>
          <Field label="Incoterm" htmlFor="sh-inco" error={errors.incoterm}>
            <Select id="sh-inco" value={f.incoterm} onChange={text("incoterm")}><option value="">Not set</option>{INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}</Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departs (ETD)" htmlFor="sh-etd" error={errors.etd}><Input id="sh-etd" type="date" value={f.etd} onChange={text("etd")} /></Field>
            <Field label="Arrives (ETA)" htmlFor="sh-eta" error={errors.eta}><Input id="sh-eta" type="date" value={f.eta} onChange={text("eta")} /></Field>
          </div>
          <Field label="Description of goods" htmlFor="sh-goods" required className="sm:col-span-2" error={errors.goods}><Textarea id="sh-goods" rows={2} value={f.goods} onChange={text("goods")} maxLength={500} /></Field>
          </>}
        </CardBody>
      </Card>

      {mode && <>

      <Card>
        <CardHeader title="2. Who is involved" description="Printed on the documents exactly as you type it." />
        <CardBody className="grid gap-8 lg:grid-cols-3">
          <PartyFields id="shipper" title="Shipper" hint="Who sends the goods" value={f.shipper} onChange={(p) => setF((s) => ({ ...s, shipper: p }))} errors={errors} required />
          <PartyFields id="consignee" title="Consignee" hint="Who receives them" value={f.consignee} onChange={(p) => setF((s) => ({ ...s, consignee: p }))} errors={errors} required />
          <PartyFields id="notifyParty" title="Notify party" hint="Optional. Told when the goods arrive." value={f.notify} onChange={(p) => setF((s) => ({ ...s, notify: p }))} errors={errors} required={false} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="3. Packages" description="One line per kind of package. Weight is the total for the line, in kg; size is per piece, in cm." />
        <ul className="divide-y divide-line">
          {f.packages.map((p, i) => (
            <li key={p.key} className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Line {i + 1}</p>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove package line ${i + 1}`} disabled={f.packages.length === 1} onClick={() => removePkg(p.key)}><Trash2 className="size-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Pieces" htmlFor={`pk-${p.key}-q`} required error={pkgError(i, "quantity")}><Input id={`pk-${p.key}-q`} inputMode="numeric" value={p.quantity} onChange={(e) => setPkg(p.key, { quantity: e.target.value })} /></Field>
                <Field label="Type" htmlFor={`pk-${p.key}-t`} required error={pkgError(i, "packageType")}>
                  <Select id={`pk-${p.key}-t`} value={p.packageType} onChange={(e) => setPkg(p.key, { packageType: e.target.value })}>{PACKAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
                </Field>
                <Field label="Description" htmlFor={`pk-${p.key}-d`} required className="sm:col-span-2" error={pkgError(i, "description")}><Input id={`pk-${p.key}-d`} value={p.description} onChange={(e) => setPkg(p.key, { description: e.target.value })} maxLength={300} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <Field label="Length (cm)" htmlFor={`pk-${p.key}-l`} error={pkgError(i, "lengthCm")}><Input id={`pk-${p.key}-l`} inputMode="decimal" value={p.length} onChange={(e) => setPkg(p.key, { length: e.target.value })} /></Field>
                <Field label="Width (cm)" htmlFor={`pk-${p.key}-w`} error={pkgError(i, "widthCm")}><Input id={`pk-${p.key}-w`} inputMode="decimal" value={p.width} onChange={(e) => setPkg(p.key, { width: e.target.value })} /></Field>
                <Field label="Height (cm)" htmlFor={`pk-${p.key}-h`} error={pkgError(i, "heightCm")}><Input id={`pk-${p.key}-h`} inputMode="decimal" value={p.height} onChange={(e) => setPkg(p.key, { height: e.target.value })} /></Field>
                <Field label="Gross weight (kg)" htmlFor={`pk-${p.key}-g`} error={pkgError(i, "grossWeightKg")}><Input id={`pk-${p.key}-g`} inputMode="decimal" value={p.weight} onChange={(e) => setPkg(p.key, { weight: e.target.value })} /></Field>
                <Field label="HS code" htmlFor={`pk-${p.key}-hs`} error={pkgError(i, "hsCode")}><Input id={`pk-${p.key}-hs`} value={p.hsCode} onChange={(e) => setPkg(p.key, { hsCode: e.target.value })} placeholder="6907.21" /></Field>
                <Field label={`Value (${currency})`} htmlFor={`pk-${p.key}-v`} error={pkgError(i, "declaredValue")}><Input id={`pk-${p.key}-v`} inputMode="decimal" value={p.value} onChange={(e) => setPkg(p.key, { value: e.target.value })} /></Field>
                <Field label="Marks and numbers" htmlFor={`pk-${p.key}-m`} error={pkgError(i, "marks")}><Input id={`pk-${p.key}-m`} value={p.marks} onChange={(e) => setPkg(p.key, { marks: e.target.value })} maxLength={200} /></Field>
              </div>
            </li>
          ))}
        </ul>
        <CardBody className="border-t border-line">
          <Button type="button" variant="secondary" onClick={addPkg}><Plus className="size-4" aria-hidden />Add a package line</Button>
          {errors.packages && <p className="mt-2 text-sm text-danger-600">{errors.packages}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="4. Transport details" description="Fill in what you know now; you can come back and add the rest." />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRANSPORT_ORDER.map((k) => {
            const spec = TRANSPORT_FIELDS[mode][k];
            if (!spec) return null;
            return (
              <Field key={k} label={spec.label} htmlFor={`sh-${k}`} hint={spec.hint} error={errors[k]}>
                <Input id={`sh-${k}`} value={f[k]} onChange={text(k)} maxLength={MAX_LEN[k]} />
              </Field>
            );
          })}
          <Field label="Marks and numbers (whole shipment)" htmlFor="sh-marks" className="sm:col-span-2" error={errors.marks}><Input id="sh-marks" value={f.marks} onChange={text("marks")} maxLength={300} /></Field>
          <Field label="Internal notes" htmlFor="sh-notes" className="sm:col-span-2 lg:col-span-3" hint="Only your team sees these." error={errors.notes}><Textarea id="sh-notes" rows={3} value={f.notes} onChange={text("notes")} maxLength={2000} /></Field>
        </CardBody>
      </Card>

      </>}

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending || !mode}>{pending ? "Saving…" : shipmentId ? "Save shipment" : "Create shipment"}</Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
