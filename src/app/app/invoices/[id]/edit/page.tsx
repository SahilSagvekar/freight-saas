import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BillingFormView } from "@/components/app/billing-form";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { billFormFrom } from "@/lib/billing-form";
import { dayString } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { formatFreightInvoiceNo } from "@/server/shared";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/app/invoices/[id]/edit">) {
  const auth = await requirePermission("payment.record");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const inv = await withTenant(auth.tenantId, (tx) => tx.freightInvoice.findUnique({ where: { id } }));
  if (!inv) notFound();
  if (inv.status !== "UNPAID") redirect(`/app/invoices/${inv.id}`);
  const initial = billFormFrom(inv, { reference: inv.reference ?? "", issuedOn: dayString(inv.issuedOn), dueOn: dayString(inv.dueOn) });
  return (
    <>
      <PageHeader back={<Link href={`/app/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{formatFreightInvoiceNo(inv.invoiceNo)}</Link>} title={`Edit ${formatFreightInvoiceNo(inv.invoiceNo)}`} />
      <BillingFormView kind="invoice" initial={initial} docId={inv.id} currency={inv.currency} links={{ shipmentId: inv.shipmentId, quoteId: inv.quoteId }} />
    </>
  );
}
