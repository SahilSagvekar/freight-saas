import { ArrowLeft, Mail, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/app/action-form";
import { BillDocument } from "@/components/app/bill-document";
import { InvoiceStatusBadge } from "@/components/app/bill-status";
import { PrintButton } from "@/components/print-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { withTenant } from "@/db";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABELS, isOverdue, nextInvoiceStatuses } from "@/lib/freight-billing";
import { dayString } from "@/lib/shipment";
import { localDateString } from "@/lib/tz";
import { can, requirePermission } from "@/server/auth";
import { setInvoiceStatusAction } from "@/server/billing-doc-actions";
import { formatFreightInvoiceNo, getTenantConfig } from "@/server/shared";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/app/invoices/[id]">) {
  const auth = await requirePermission("invoice.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withTenant(auth.tenantId, async (tx) => {
    const inv = await tx.freightInvoice.findUnique({ where: { id } });
    return inv ? { inv, config: await getTenantConfig(tx) } : null;
  });
  if (!data) notFound();
  const { inv, config } = data;
  const no = formatFreightInvoiceNo(inv.invoiceNo);
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const overdue = isOverdue(inv.status, dayString(inv.dueOn), today);
  const writer = can(auth, "payment.record");
  const subject = encodeURIComponent(`Invoice ${no} from ${auth.tenant.name}`);

  return (
    <>
      <div className="no-print">
        <div className="mb-4"><Link href="/app/invoices" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All invoices</Link></div>
        <Card className="mb-6">
          <CardHeader title={`${no} · ${inv.customerCompany || inv.customerName}`} description={<InvoiceStatusBadge status={inv.status} overdue={overdue} />} />
          <CardBody className="flex flex-wrap items-start gap-3">
            {writer && inv.status === "UNPAID" && <ButtonLink href={`/app/invoices/${inv.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden />Edit</ButtonLink>}
            {inv.customerEmail && <ButtonLink href={`mailto:${inv.customerEmail}?subject=${subject}`} variant="secondary"><Mail className="size-4" aria-hidden />Email customer</ButtonLink>}
            <PrintButton label="Print or save as PDF" />
            {writer && nextInvoiceStatuses(inv.status).map((to) => (
              <ActionForm key={to} action={setInvoiceStatusAction} reset={false} submitLabel={inv.status === "PAID" && to === "UNPAID" ? "Mark unpaid again" : `Mark ${INVOICE_STATUS_LABELS[to].toLowerCase()}`} className="[&>button]:mt-0">
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value={to} />
              </ActionForm>
            ))}
            {inv.shipmentId && <ButtonLink href={`/app/shipments/${inv.shipmentId}`} variant="ghost">Shipment</ButtonLink>}
          </CardBody>
        </Card>
      </div>
      <BillDocument
        title="Invoice"
        number={no}
        sub={inv.reference ? `Ref. ${inv.reference}` : undefined}
        company={{ name: auth.tenant.name, ...config.company }}
        doc={inv}
        meta={[["Invoice date", formatDate(inv.issuedOn)], ["Due", formatDate(inv.dueOn)], ...(inv.paidOn ? [["Paid", formatDate(inv.paidOn)] as [string, string]] : []), ...(inv.status === "VOID" ? [["Status", "VOID"] as [string, string]] : [])]}
        footer={config.documentTerms || undefined}
      />
    </>
  );
}
