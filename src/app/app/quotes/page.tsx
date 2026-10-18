import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { QuoteStatusBadge } from "@/components/app/bill-status";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from "@/lib/freight-billing";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth";
import { listQuotes, quoteCounts } from "@/server/quotes";
import { formatQuoteNo } from "@/server/shared";

export const metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const auth = await requirePermission("booking.create");
  const active = QUOTE_STATUSES.find((s) => s === status);
  const { rows, counts } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listQuotes(tx, { status: active }), counts: await quoteCounts(tx) }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pill = "rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  return (
    <>
      <PageHeader title="Quotes" description="Prices you have offered customers." actions={<ButtonLink href="/app/quotes/new"><Plus className="size-4" aria-hidden />New quote</ButtonLink>} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
        <Link href="/app/quotes" aria-current={!active ? "page" : undefined} className={cn(pill, !active ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>All ({total})</Link>
        {QUOTE_STATUSES.map((s) => (
          <Link key={s} href={`/app/quotes?status=${s}`} aria-current={active === s ? "page" : undefined} className={cn(pill, active === s ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>{QUOTE_STATUS_LABELS[s]} ({counts[s]})</Link>
        ))}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title={active ? `No ${QUOTE_STATUS_LABELS[active].toLowerCase()} quotes` : "No quotes yet"} description="Open an inquiry and choose “Create quote”, or start a blank one." />
        ) : (
          <Table>
            <thead><tr><Th>Quote</Th><Th>Customer</Th><Th>Route</Th><Th>Status</Th><Th>Valid until</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td><Link className="font-medium text-brand-700 hover:underline" href={`/app/quotes/${r.id}`}>{formatQuoteNo(r.quoteNo)}</Link></Td>
                  <Td>{r.customerCompany || r.customerName}</Td>
                  <Td><span className="block">{r.origin} → {r.destination}</span><span className="text-xs text-muted">{MODE_LABELS[r.mode as TransportMode] ?? r.mode}</span></Td>
                  <Td><QuoteStatusBadge status={r.status} /></Td>
                  <Td className="text-muted">{r.validUntil ? formatDate(r.validUntil) : "—"}</Td>
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
