import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/app/action-form";
import { InquiryStatusBadge } from "@/components/app/inquiry-status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES, MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { isShipmentMode } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { convertInquiryAction } from "@/server/shipment-actions";
import { saveInquiryNotesAction, setInquiryStatusAction } from "@/server/inquiry-actions";
import { formatInquiryNo } from "@/server/shared";

export const metadata = { title: "Inquiry" };

export default async function InquiryDetailPage({ params, searchParams }: PageProps<"/app/inquiries/[id]">) {
  const auth = await requirePermission("booking.create");
  const { id } = await params;
  const { mode: modeNote } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await withTenant(auth.tenantId, (tx) => tx.inquiry.findUnique({ where: { id } }));
  if (!r) notFound();
  const no = formatInquiryNo(r.inquiryNo);
  const needsMode = !isShipmentMode(r.mode);
  const subject = encodeURIComponent(`Your quote request ${no}: ${r.origin} to ${r.destination}`);
  const rows: [string, string | null][] = [
    ["Mode", MODE_LABELS[r.mode as TransportMode] ?? r.mode],
    ["From", r.origin],
    ["To", r.destination],
    ["Cargo", r.cargo],
    ["Weight", r.weightKg != null ? `${r.weightKg} kg` : null],
    ["Ready to ship", r.readyOn ? r.readyOn.toISOString().slice(0, 10) : null],
    ["Message", r.message],
  ];

  return (
    <>
      <PageHeader
        back={<Link href="/app/inquiries" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All inquiries</Link>}
        title={`${no} · ${r.name}`}
        description={`Received ${formatDateTime(r.createdAt)}`}
        actions={<ButtonLink href={`mailto:${r.email}?subject=${subject}`}><Mail className="size-4" aria-hidden />Reply by email</ButtonLink>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title="Request" />
          <dl className="divide-y divide-line text-sm">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_1fr]"><dt className="text-muted">{k}</dt><dd className="whitespace-pre-wrap break-words font-medium">{v}</dd></div>
            ))}
          </dl>
          <CardBody className="border-t border-line text-sm">
            <p className="font-medium">{r.name}{r.company ? `, ${r.company}` : ""}</p>
            <p className="text-muted"><a className="hover:underline" href={`mailto:${r.email}`}>{r.email}</a>{r.phone ? ` · ${r.phone}` : ""}</p>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="space-y-3">
              <InquiryStatusBadge status={r.status} />
              <div className="flex flex-wrap gap-2">
                {INQUIRY_STATUSES.filter((s) => s !== r.status).map((s) => (
                  <ActionForm key={s} action={setInquiryStatusAction} reset={false} submitLabel={`Mark ${INQUIRY_STATUS_LABELS[s].toLowerCase()}`} className="[&>button]:mt-0">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={s} />
                  </ActionForm>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Price it"  description="Starts a quote with the customer and route filled in." />
            <CardBody><ButtonLink href={`/app/quotes/new?inquiry=${r.id}`} variant="secondary">Create quote</ButtonLink></CardBody>
          </Card>
          <Card>
            <CardHeader title="Won this job?" description="Starts a shipment with these details filled in and marks the inquiry won." />
            <CardBody>
              <form action={convertInquiryAction}>
                <input type="hidden" name="id" value={r.id} />
                {needsMode && (
                  <fieldset className="mb-3 space-y-1.5">
                    <legend className="text-sm font-medium text-ink">The customer wasn&apos;t sure. How is it travelling?</legend>
                    {(["AIR", "OCEAN", "GROUND"] as const).map((m, i) => (
                      <label key={m} className="flex items-center gap-2 text-sm"><input type="radio" name="mode" value={m} required={i === 0} />{MODE_LABELS[m]}</label>
                    ))}
                    {modeNote === "needed" && <p role="alert" className="text-sm text-danger-600">Choose air, ocean or road first.</p>}
                  </fieldset>
                )}
                <Button type="submit">Convert to shipment</Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Private notes" description="Only your team sees these." />
            <CardBody>
              <ActionForm action={saveInquiryNotesAction} reset={false} submitLabel="Save notes">
                <input type="hidden" name="id" value={r.id} />
                <Textarea name="notes" aria-label="Private notes" defaultValue={r.notes ?? ""} maxLength={4000} rows={5} />
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
