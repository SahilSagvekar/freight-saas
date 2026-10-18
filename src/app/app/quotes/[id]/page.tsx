import { ArrowLeft, Mail, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/app/action-form";
import { BillDocument } from "@/components/app/bill-document";
import { QuoteStatusBadge } from "@/components/app/bill-status";
import { PrintButton } from "@/components/print-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { withTenant } from "@/db";
import { MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { nextQuoteStatuses, QUOTE_STATUS_LABELS } from "@/lib/freight-billing";
import { can, requirePermission } from "@/server/auth";
import { quoteToShipmentAction, setQuoteStatusAction } from "@/server/billing-doc-actions";
import { formatQuoteNo, formatShipmentNo, getTenantConfig } from "@/server/shared";

export const metadata = { title: "Quote" };

export default async function QuotePage({ params }: PageProps<"/app/quotes/[id]">) {
  const auth = await requirePermission("booking.create");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withTenant(auth.tenantId, async (tx) => {
    const q = await tx.quote.findUnique({ where: { id } });
    if (!q) return null;
    const shipment = q.shipmentId ? await tx.shipment.findUnique({ where: { id: q.shipmentId }, select: { id: true, shipmentNo: true } }) : null;
    return { q, shipment, config: await getTenantConfig(tx) };
  });
  if (!data) notFound();
  const { q, shipment, config } = data;
  const no = formatQuoteNo(q.quoteNo);
  const subject = encodeURIComponent(`Quote ${no}: ${q.origin} to ${q.destination}`);
  const next = nextQuoteStatuses(q.status);

  return (
    <>
      <div className="no-print">
        <div className="mb-4"><Link href="/app/quotes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All quotes</Link></div>
        <Card className="mb-6">
          <CardHeader title={`${no} · ${q.customerCompany || q.customerName}`} description={<span className="inline-flex items-center gap-2"><QuoteStatusBadge status={q.status} />{MODE_LABELS[q.mode as TransportMode] ?? q.mode}</span>} />
          <CardBody className="flex flex-wrap items-start gap-3">
            {q.status !== "ACCEPTED" && <ButtonLink href={`/app/quotes/${q.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />Edit</ButtonLink>}
            {q.customerEmail && <ButtonLink href={`mailto:${q.customerEmail}?subject=${subject}`} variant="secondary"><Mail className="size-4" aria-hidden />Email customer</ButtonLink>}
            <PrintButton label="Print or save as PDF" />
            {next.map((to) => (
              <ActionForm key={to} action={setQuoteStatusAction} reset={false} submitLabel={to === "DRAFT" ? "Reopen as draft" : `Mark ${QUOTE_STATUS_LABELS[to].toLowerCase()}`} className="[&>button]:mt-0">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="status" value={to} />
              </ActionForm>
            ))}
            {shipment ? (
              <ButtonLink href={`/app/shipments/${shipment.id}`}>Shipment {formatShipmentNo(shipment.shipmentNo)}</ButtonLink>
            ) : (
              q.status !== "REJECTED" && (
                <form action={quoteToShipmentAction}><input type="hidden" name="id" value={q.id} /><Button type="submit">Accept and create shipment</Button></form>
              )
            )}
            {can(auth, "payment.record") && <ButtonLink href={`/app/invoices/new?quote=${q.id}`} variant="secondary">Create invoice</ButtonLink>}
          </CardBody>
        </Card>
      </div>
      <BillDocument
        title="Quote"
        number={no}
        sub={q.origin + " → " + q.destination}
        company={{ name: auth.tenant.name, ...config.company }}
        doc={q}
        meta={[["Date", formatDate(q.createdAt)], ...(q.validUntil ? [["Valid until", formatDate(q.validUntil)] as [string, string]] : []), ["Mode", MODE_LABELS[q.mode as TransportMode] ?? q.mode]]}
        footer={config.documentTerms || undefined}
      />
    </>
  );
}
