"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { emptyPackage, toShipmentPayload, type PackageForm, type PartyForm, type ShipmentForm } from "@/lib/shipment-form";
import { INCOTERMS, PACKAGE_TYPES, SHIPMENT_MODES } from "@/lib/shipment";
import { MODE_LABELS } from "@/lib/domain";
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

export function ShipmentFormView({ initial, shipmentId, currency }: { initial: ShipmentForm; shipmentId: string | null; currency: string }) {
  const router = useRouter();
  const [f, setF] = useState<ShipmentForm>(initial);
  const [nextKey, setNextKey] = useState(initial.packages.reduce((m, p) => Math.max(m, p.key), 0) + 1);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const text = (k: keyof ShipmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
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
          <Field label="Mode" htmlFor="sh-mode" required error={errors.mode}>
            <Select id="sh-mode" value={f.mode} onChange={text("mode")}>{SHIPMENT_MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</Select>
          </Field>
          <Field label="Customer reference" htmlFor="sh-ref" hint="Their PO or job number" error={errors.customerRef}><Input id="sh-ref" value={f.customerRef} onChange={text("customerRef")} maxLength={80} /></Field>
          <Field label="From" htmlFor="sh-origin" required hint="City, port or airport" error={errors.origin}><Input id="sh-origin" value={f.origin} onChange={text("origin")} maxLength={160} /></Field>
          <Field label="To" htmlFor="sh-dest" required hint="City, port or airport" error={errors.destination}><Input id="sh-dest" value={f.destination} onChange={text("destination")} maxLength={160} /></Field>
          <Field label="Incoterm" htmlFor="sh-inco" error={errors.incoterm}>
            <Select id="sh-inco" value={f.incoterm} onChange={text("incoterm")}><option value="">Not set</option>{INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}</Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departs (ETD)" htmlFor="sh-etd" error={errors.etd}><Input id="sh-etd" type="date" value={f.etd} onChange={text("etd")} /></Field>
            <Field label="Arrives (ETA)" htmlFor="sh-eta" error={errors.eta}><Input id="sh-eta" type="date" value={f.eta} onChange={text("eta")} /></Field>
          </div>
          <Field label="Description of goods" htmlFor="sh-goods" required className="sm:col-span-2" error={errors.goods}><Textarea id="sh-goods" rows={2} value={f.goods} onChange={text("goods")} maxLength={500} /></Field>
        </CardBody>
      </Card>

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
          <Field label="Carrier" htmlFor="sh-carrier" error={errors.carrier}><Input id="sh-carrier" value={f.carrier} onChange={text("carrier")} maxLength={120} /></Field>
          <Field label="Vessel or flight" htmlFor="sh-vessel" error={errors.vesselOrFlight}><Input id="sh-vessel" value={f.vesselOrFlight} onChange={text("vesselOrFlight")} maxLength={120} /></Field>
          <Field label="Voyage or flight no." htmlFor="sh-voyage" error={errors.voyageNo}><Input id="sh-voyage" value={f.voyageNo} onChange={text("voyageNo")} maxLength={60} /></Field>
          <Field label="Master B/L or MAWB no." htmlFor="sh-master" error={errors.masterNo}><Input id="sh-master" value={f.masterNo} onChange={text("masterNo")} maxLength={60} /></Field>
          <Field label="House B/L or HAWB no." htmlFor="sh-house" hint="Printed as the document number" error={errors.houseNo}><Input id="sh-house" value={f.houseNo} onChange={text("houseNo")} maxLength={60} /></Field>
          <Field label="Container no." htmlFor="sh-cont" error={errors.containerNo}><Input id="sh-cont" value={f.containerNo} onChange={text("containerNo")} maxLength={60} /></Field>
          <Field label="Seal no." htmlFor="sh-seal" error={errors.sealNo}><Input id="sh-seal" value={f.sealNo} onChange={text("sealNo")} maxLength={60} /></Field>
          <Field label="Marks and numbers (whole shipment)" htmlFor="sh-marks" className="sm:col-span-2" error={errors.marks}><Input id="sh-marks" value={f.marks} onChange={text("marks")} maxLength={300} /></Field>
          <Field label="Internal notes" htmlFor="sh-notes" className="sm:col-span-2 lg:col-span-3" hint="Only your team sees these." error={errors.notes}><Textarea id="sh-notes" rows={3} value={f.notes} onChange={text("notes")} maxLength={2000} /></Field>
        </CardBody>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : shipmentId ? "Save shipment" : "Create shipment"}</Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
