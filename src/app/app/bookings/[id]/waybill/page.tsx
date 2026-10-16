import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { withTenant } from "@/db";
import { formatInZone } from "@/lib/tz";
import { requirePermission } from "@/server/auth";
import { lineWeightKg } from "@/server/reports";
import { loadTicket } from "@/server/tickets";

export const metadata = { title: "Waybill" };

const SKIP = new Set(["weight", "weight_kg", "weightKg"]);

export default async function WaybillPage({ params }: PageProps<"/app/bookings/[id]/waybill">) {
  const auth = await requirePermission("booking.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await withTenant(auth.tenantId, (tx) => loadTicket(tx, auth.tenantId, id));
  const cargo = t?.lines.filter((l) => l.kind === "CARGO") ?? [];
  if (!t || cargo.length === 0) notFound();
  const totalKg = cargo.reduce((a, l) => a + lineWeightKg(l.attributes, l.quantity), 0);

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/app/bookings/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Booking {t.bookingNo}</Link>
        <PrintButton label="Print waybill" />
      </div>
      <article className="mx-auto max-w-3xl rounded-lg border border-line-strong bg-white p-8 text-ink print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b-2 border-ink pb-4">
          <div><h1 className="text-2xl font-bold uppercase tracking-wide">Freight waybill</h1><p className="text-sm text-muted">{t.operatorName}</p></div>
          <div className="text-right text-sm"><p className="font-mono text-lg font-semibold">{t.bookingNo}</p>{t.voyage && <p className="text-muted">{formatInZone(t.voyage.departureAt, t.timeZone, t.locale)}</p>}</div>
        </header>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted">Sender</dt><dd className="font-medium">{t.contactName}</dd></div>
          <div><dt className="text-muted">Route</dt><dd className="font-medium">{t.voyage ? `${t.voyage.origin} → ${t.voyage.destination}` : "—"}</dd></div>
          <div><dt className="text-muted">Vessel</dt><dd className="font-medium">{t.voyage?.vessel ?? "—"}</dd></div>
          <div><dt className="text-muted">Total weight</dt><dd className="font-medium">{totalKg ? `${totalKg} kg` : "Not recorded"}</dd></div>
        </dl>
        <table className="mt-6 w-full border-collapse text-sm">
          <thead><tr className="border-y border-ink text-left"><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Description</th><th className="py-2">Details</th></tr></thead>
          <tbody>
            {cargo.map((l, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2 pr-3 font-medium">{l.quantity}</td>
                <td className="py-2 pr-3">{l.description}</td>
                <td className="py-2 text-muted">{Object.entries(l.attributes).filter(([k, v]) => !SKIP.has(k) && v !== "" && v !== false).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v === true ? "yes" : v}`).join(" · ")}{lineWeightKg(l.attributes, l.quantity) ? ` · ${lineWeightKg(l.attributes, l.quantity)} kg` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-12 grid grid-cols-3 gap-8 text-sm">
          {["Handed over by (sender)", "Loaded by (crew)", "Received by (consignee)"].map((label) => (
            <div key={label}><div className="h-14 border-b border-ink" /><p className="mt-1 text-muted">{label}</p><p className="mt-4 text-muted">Date: ____________</p></div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted">Goods are carried subject to the operator&apos;s terms. Check the contents and count before signing.</p>
      </article>
    </>
  );
}
