import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BillingFormView } from "@/components/app/billing-form";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { billFormFrom } from "@/lib/billing-form";
import { dayString } from "@/lib/shipment";
import { requirePermission } from "@/server/auth";
import { formatQuoteNo } from "@/server/shared";

export const metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: PageProps<"/app/quotes/[id]/edit">) {
  const auth = await requirePermission("booking.create");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const q = await withTenant(auth.tenantId, (tx) => tx.quote.findUnique({ where: { id } }));
  if (!q) notFound();
  if (q.status === "ACCEPTED") redirect(`/app/quotes/${q.id}`);
  const initial = billFormFrom(q, { mode: q.mode, origin: q.origin, destination: q.destination, validUntil: dayString(q.validUntil) });
  return (
    <>
      <PageHeader back={<Link href={`/app/quotes/${q.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{formatQuoteNo(q.quoteNo)}</Link>} title={`Edit ${formatQuoteNo(q.quoteNo)}`} />
      <BillingFormView kind="quote" initial={initial} docId={q.id} currency={q.currency} links={{ inquiryId: q.inquiryId }} />
    </>
  );
}
