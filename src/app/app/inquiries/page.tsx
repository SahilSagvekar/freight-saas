import { Inbox } from "lucide-react";
import Link from "next/link";
import { InquiryStatusBadge } from "@/components/app/inquiry-status";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { withTenant } from "@/db";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES, MODE_LABELS, type TransportMode } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth";
import { inquiryCounts, listInquiries } from "@/server/inquiries";
import { formatInquiryNo } from "@/server/shared";

export const metadata = { title: "Inquiries" };

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const auth = await requirePermission("booking.create");
  const active = INQUIRY_STATUSES.find((s) => s === status);
  const { rows, counts } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listInquiries(tx, { status: active }), counts: await inquiryCounts(tx) }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tab = "rounded-full px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <>
      <PageHeader title="Inquiries" description="Quote requests from your website form, newest first." />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
        <Link href="/app/inquiries" aria-current={!active ? "page" : undefined} className={cn(tab, !active ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>All ({total})</Link>
        {INQUIRY_STATUSES.map((s) => (
          <Link key={s} href={`/app/inquiries?status=${s}`} aria-current={active === s ? "page" : undefined} className={cn(tab, active === s ? "bg-brand-600 text-white" : "bg-line/70 text-muted hover:text-ink")}>
            {INQUIRY_STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title={active ? `No ${INQUIRY_STATUS_LABELS[active].toLowerCase()} inquiries` : "No inquiries yet"} description="When someone sends the form on your website, it shows up here and your team gets an email." />
        ) : (
          <Table>
            <thead><tr><Th>Inquiry</Th><Th>From</Th><Th>Shipment</Th><Th>Status</Th><Th>Received</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td><Link className="font-medium text-brand-700 hover:underline" href={`/app/inquiries/${r.id}`}>{formatInquiryNo(r.inquiryNo)}</Link></Td>
                  <Td><span className="block font-medium">{r.name}</span><span className="text-xs text-muted">{r.company ?? r.email}</span></Td>
                  <Td><span className="block">{MODE_LABELS[r.mode as TransportMode] ?? r.mode}: {r.origin} → {r.destination}</span><span className="line-clamp-1 text-xs text-muted">{r.cargo}</span></Td>
                  <Td><InquiryStatusBadge status={r.status} /></Td>
                  <Td className="text-muted">{formatDateTime(r.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
