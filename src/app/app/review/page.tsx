import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ReviewButtons } from "@/components/app/booking-actions";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { formatDeparture } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/server/auth";
import { listBookings } from "@/server/queries";
import { formatBookingNo, getTenantConfig } from "@/server/shared";

export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const auth = await requirePermission("booking.review");
  const { rows, config } = await withTenant(auth.tenantId, async (tx) => ({ rows: await listBookings(tx, { status: "NEEDS_REVIEW" }), config: await getTenantConfig(tx) }));
  return (
    <>
      <PageHeader title="Review queue" description="Sales made offline that need a decision, for example when a sailing filled up or a price changed." />
      {rows.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="Nothing to review" description="Offline sales that clash with the live record will appear here." /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/app/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">{formatBookingNo(config, b.bookingNo)}</Link>
                  <span className="ml-2 text-sm text-muted">{b.contactName} · {formatMoney(b.total, b.currency, auth.tenant.locale)}</span>
                  <p className="mt-1 text-sm text-muted">{b.originName} → {b.destinationName} · {formatDeparture(b.departureAt)}</p>
                  <p className="mt-2 rounded-md bg-warn-50 px-3 py-2 text-sm text-warn-700">{b.reviewReason}</p>
                </div>
                <ReviewButtons bookingId={b.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
