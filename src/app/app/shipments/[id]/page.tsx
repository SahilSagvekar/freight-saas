import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/app/action-form";
import { ShipmentStatusBadge } from "@/components/app/shipment-status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { airChargeableKg, nextShipmentStatuses, packageTotals, SHIPMENT_STATUS_LABELS } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { setShipmentStatusAction } from "@/server/shipment-actions";
import { formatInquiryNo, formatShipmentNo } from "@/server/shared";
import { getShipment, packageLinesOf, partyOf } from "@/server/shipments";

export const metadata = { title: "Shipment" };

function Party({ title, json }: { title: string; json: unknown }) {
  const p = partyOf(json);
  return (
    <div className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {p.name ? (
        <>
          <p className="mt-1 font-medium">{p.name}</p>
          <p className="whitespace-pre-line text-muted">{p.address}</p>
          <p className="text-muted">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
          {p.taxId && <p className="text-muted">Tax no. {p.taxId}</p>}
        </>
      ) : (
        <p className="mt-1 text-muted">Not set</p>
      )}
    </div>
  );
}

export default async function ShipmentPage({ params }: PageProps<"/app/shipments/[id]">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withTenant(auth.tenantId, async (tx) => {
    const s = await getShipment(tx, id);
    if (!s) return null;
    const inquiry = s.inquiryId ? await tx.inquiry.findUnique({ where: { id: s.inquiryId }, select: { id: true, inquiryNo: true } }) : null;
    return { s, inquiry };
  });
  if (!data) notFound();
  const { s, inquiry } = data;
  const lines = packageLinesOf(s.packages);
  const totals = packageTotals(lines);
  const canEdit = auth.permissions.has("booking.create");
  const canMove = auth.permissions.has("manifest.update");
  const next = nextShipmentStatuses(s.status);

  const facts: [string, string | null][] = [
    ["Mode", MODE_LABELS[s.mode as TransportMode] ?? s.mode],
    ["Route", `${s.origin} → ${s.destination}`],
    ["Customer reference", s.customerRef],
    ["Incoterm", s.incoterm],
    ["Carrier", s.carrier],
    ["Vessel or flight", [s.vesselOrFlight, s.voyageNo].filter(Boolean).join(" ") || null],
    [s.mode === "AIR" ? "MAWB" : "Master B/L", s.masterNo],
    [s.mode === "AIR" ? "HAWB" : "House B/L", s.houseNo],
    ["Container", s.containerNo],
    ["Seal", s.sealNo],
    ["ETD", s.etd ? formatDate(s.etd) : null],
    ["ETA", s.eta ? formatDate(s.eta) : null],
  ];

  return (
    <>
      <PageHeader
        back={<Link href="/app/shipments" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All shipments</Link>}
        title={`${formatShipmentNo(s.shipmentNo)} · ${s.goods.slice(0, 60)}`}
        description={<span className="inline-flex flex-wrap items-center gap-2"><ShipmentStatusBadge status={s.status} />Created {formatDateTime(s.createdAt)}{inquiry && <>· from <Link className="text-brand-700 hover:underline" href={`/app/inquiries/${inquiry.id}`}>{formatInquiryNo(inquiry.inquiryNo)}</Link></>}</span>}
        actions={canEdit ? <ButtonLink href={`/app/shipments/${s.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />Edit</ButtonLink> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line text-sm">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid gap-1 px-5 py-2.5 sm:grid-cols-[10rem_1fr]"><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Party title="Shipper" json={s.shipper} />
              <Party title="Consignee" json={s.consignee} />
              <Party title="Notify party" json={s.notifyParty} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Packages" description={`${totals.pieces} pieces · ${totals.grossKg} kg gross · ${totals.cbm} m³${s.mode === "AIR" ? ` · ${airChargeableKg(totals)} kg chargeable` : ""}${totals.declaredValue ? ` · ${formatMoney(totals.declaredValue, s.currency)} declared` : ""}`} />
            <ul className="divide-y divide-line text-sm">
              {lines.map((l, i) => (
                <li key={i} className="px-5 py-3">
                  <p className="font-medium">{l.quantity} × {l.packageType}: {l.description}</p>
                  <p className="text-xs text-muted">{[l.lengthCm && l.widthCm && l.heightCm ? `${l.lengthCm}×${l.widthCm}×${l.heightCm} cm` : null, l.grossWeightKg ? `${l.grossWeightKg} kg` : null, l.hsCode ? `HS ${l.hsCode}` : null, l.declaredValue ? formatMoney(l.declaredValue, s.currency) : null, l.marks].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
            {totals.linesWithoutWeight > 0 && <CardBody className="border-t border-line text-xs text-muted">{totals.linesWithoutWeight} line(s) have no weight yet, so the totals are low.</CardBody>}
          </Card>
          {s.notes && (
            <Card><CardHeader title="Internal notes" /><CardBody className="whitespace-pre-wrap text-sm">{s.notes}</CardBody></Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="space-y-4">
              {canMove && next.length > 0 ? (
                <div className="space-y-3">
                  {next.map((to) => (
                    <ActionForm key={to} action={setShipmentStatusAction} submitLabel={`Mark ${SHIPMENT_STATUS_LABELS[to].toLowerCase()}`} className="space-y-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value={to} />
                      <Input name="location" aria-label="Where (optional)" placeholder="Where? (optional)" maxLength={160} />
                      <Input name="note" aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500} />
                    </ActionForm>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{next.length === 0 ? "No further steps." : "You can view but not change the status."}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="divide-y divide-line text-sm">
              {s.events.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <p className="font-medium">{SHIPMENT_STATUS_LABELS[e.status as keyof typeof SHIPMENT_STATUS_LABELS] ?? e.status}{e.location ? ` · ${e.location}` : ""}</p>
                  {e.note && <p className="text-muted">{e.note}</p>}
                  <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
