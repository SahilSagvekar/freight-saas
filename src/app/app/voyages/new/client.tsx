"use client";

import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/app/action-form";
import { Field, Input, Select } from "@/components/ui/field";
import { createVoyageAction } from "@/server/settings-actions";

type Opt = { id: string; name: string };

export function VoyageForm({ vessels, ports }: { vessels: Opt[]; ports: Opt[] }) {
  const router = useRouter();
  return (
    <ActionForm action={createVoyageAction} submitLabel="Schedule voyage" reset={false} onSuccess={(r) => r.id && router.push(`/app/voyages/${r.id}`)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vessel" htmlFor="vesselId" required className="sm:col-span-2"><Select id="vesselId" name="vesselId">{vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="From" htmlFor="originId" required><Select id="originId" name="originId">{ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="To" htmlFor="destinationId" required><Select id="destinationId" name="destinationId" defaultValue={ports[1]?.id}>{ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Departure" htmlFor="departureAt" required className="sm:col-span-2"><Input id="departureAt" name="departureAt" type="datetime-local" required /></Field>
      </div>
    </ActionForm>
  );
}
