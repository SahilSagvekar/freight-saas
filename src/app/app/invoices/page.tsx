import { Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/app/bill-status";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES, isOverdue } from "@/lib/freight-billing";
import { formatMoney } from "@/lib/money";
import { dayString } from "@/lib/shipment";
import { localDateString } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { can, requirePermission } from "@/server/auth";
import { freightInvoiceCounts, listFreightInvoices } from "@/server/freight-invoices";
import { formatFreightInvoiceNo } from "@/server/shared";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const auth = await requirePermission("invoice.view");
  const active = INVOICE_STATUSES.find((s) => s === status);
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const { rows, counts } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listFreightInvoices(tx, { status: active }), counts: await freightInvoiceCounts(tx) }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pill = "rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  return (
    <>
      <PageHeader title="Invoices" description="What your customers owe you." actions={can(auth, "payment.record") ? <ButtonLink href="/app/invoices/new"><Plus className="size-4" aria-hidden />New invoice</ButtonLink> : undefined} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
        <Link href="/app/invoices" aria-current={!active ? "page" : undefined} className={cn(pill, !active ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>All ({total})</Link>
        {INVOICE_STATUSES.map((s) => (
          <Link key={s} href={`/app/invoices?status=${s}`} aria-current={active === s ? "page" : undefined} className={cn(pill, active === s ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>{INVOICE_STATUS_LABELS[s]} ({counts[s]})</Link>
        ))}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title={active ? `No ${INVOICE_STATUS_LABELS[active].toLowerCase()} invoices` : "No invoices yet"} description="Create one from a quote, a shipment, or from scratch." />
        ) : (
          <Table>
            <thead><tr><Th>Invoice</Th><Th>Customer</Th><Th>Status</Th><Th>Due</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td><Link className="font-medium text-brand-700 hover:underline" href={`/app/invoices/${r.id}`}>{formatFreightInvoiceNo(r.invoiceNo)}</Link>{r.reference && <span className="block text-xs text-muted">{r.reference}</span>}</Td>
                  <Td>{r.customerCompany || r.customerName}</Td>
                  <Td><InvoiceStatusBadge status={r.status} overdue={isOverdue(r.status, dayString(r.dueOn), today)} /></Td>
                  <Td className="text-muted">{formatDate(r.dueOn)}</Td>
                  <Td className="text-right font-medium">{formatMoney(r.total, r.currency)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
