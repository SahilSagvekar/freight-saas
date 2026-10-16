import { Anchor } from "lucide-react";
import { KIND_LABELS } from "@/lib/domain";
import { formatInZone } from "@/lib/tz";
import { ticketCode } from "@/lib/ticket-code";
import type { TicketData } from "@/server/tickets";
import { QrCode } from "./qr-code";

/** A boarding pass that prints on A5/A4 and reads on a phone. The QR holds a signed code, not personal data. */
export function TicketSheet({ t }: { t: TicketData }) {
  const code = ticketCode(t.bookingId);
  const void_ = t.status === "CANCELLED";
  return (
    <article className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-white text-ink shadow-card print:rounded-none print:border-0 print:shadow-none">
      <header className="flex items-center justify-between bg-navy-900 px-6 py-4 text-white print:bg-white print:text-ink print:border-b print:border-ink">
        <span className="flex items-center gap-2 font-semibold"><Anchor className="size-5" aria-hidden />{t.operatorName}</span>
        <span className="text-sm opacity-80">Boarding pass</span>
      </header>
      <div className="relative p-6">
        {void_ && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"><span className="-rotate-12 rounded-lg border-4 border-danger-600 px-6 py-2 text-3xl font-bold uppercase text-danger-600">Cancelled</span></div>}
        {t.voyage ? (
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-wide text-muted">From</p><p className="text-2xl font-semibold">{t.voyage.origin}</p></div>
            <span aria-hidden className="text-2xl text-subtle">→</span>
            <div className="text-right"><p className="text-xs uppercase tracking-wide text-muted">To</p><p className="text-2xl font-semibold">{t.voyage.destination}</p></div>
          </div>
        ) : null}
        {t.voyage && (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Departs</dt><dd className="font-medium">{formatInZone(t.voyage.departureAt, t.timeZone, t.locale)}</dd></div>
            <div><dt className="text-muted">Vessel</dt><dd className="font-medium">{t.voyage.vessel}</dd></div>
            <div><dt className="text-muted">Booked by</dt><dd className="font-medium">{t.contactName}</dd></div>
            <div><dt className="text-muted">Booking</dt><dd className="font-mono font-medium">{t.bookingNo}</dd></div>
          </dl>
        )}
        <ul className="mt-5 divide-y divide-line rounded-lg border border-line text-sm">
          {t.lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span><span className="font-medium">{l.quantity} × {l.description}</span>{l.details && <span className="block text-xs text-muted">{l.details}</span>}</span>
              <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{KIND_LABELS[l.kind]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-dashed border-line-strong pt-5">
          <div className="text-sm">
            <p className="font-medium">Show this at the gangway</p>
            <p className="text-muted">{t.paymentStatus === "PAID" ? "Paid in full" : t.paymentStatus === "PARTIAL" ? "Part paid — pay the balance at the desk" : t.paymentStatus === "UNPAID" ? "Pay at the desk before boarding" : ""}</p>
            <p className="mt-2 break-all font-mono text-[10px] text-subtle">{code}</p>
          </div>
          <QrCode value={code} size={150} label={`Ticket ${t.bookingNo}`} />
        </div>
      </div>
    </article>
  );
}
