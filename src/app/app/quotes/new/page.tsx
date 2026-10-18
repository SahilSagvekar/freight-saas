import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BillingFormView } from "@/components/app/billing-form";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { emptyBillForm } from "@/lib/billing-form";
import { addDays } from "@/lib/freight-billing";
import { localDateString } from "@/lib/tz";
import { requirePermission } from "@/server/auth";
import { getTenantConfig } from "@/server/shared";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ inquiry?: string }> }) {
  const { inquiry } = await searchParams;
  const auth = await requirePermission("booking.create");
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const { config, inq } = await withTenant(auth.tenantId, async (tx) => ({
    config: await getTenantConfig(tx),
    inq: inquiry && /^[0-9a-f-]{36}$/i.test(inquiry) ? await tx.inquiry.findUnique({ where: { id: inquiry } }) : null,
  }));
  const initial = emptyBillForm({
    validUntil: addDays(today, config.quoteValidDays),
    taxPercent: String(config.freightTaxBp / 100),
    ...(inq ? { customerName: inq.name, customerCompany: inq.company ?? "", customerEmail: inq.email, mode: inq.mode === "AIR" || inq.mode === "GROUND" ? inq.mode : "OCEAN", origin: inq.origin, destination: inq.destination } : {}),
  });
  return (
    <>
      <PageHeader back={<Link href="/app/quotes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All quotes</Link>} title="New quote" description={inq ? `For inquiry from ${inq.name}: ${inq.cargo}` : undefined} />
      <BillingFormView kind="quote" initial={initial} docId={null} currency={auth.tenant.baseCurrency} links={{ inquiryId: inq?.id ?? null }} />
    </>
  );
}
