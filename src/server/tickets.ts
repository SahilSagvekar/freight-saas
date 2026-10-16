import type { Tx } from "@/db";
import { describeAttributes } from "@/lib/attributes";
import type { FieldDef, ItemKind } from "@/lib/domain";
import { getBookingDetail } from "./queries";
import { formatBookingNo, getTenantConfig } from "./shared";

export type TicketData = {
  bookingId: string;
  bookingNo: string;
  status: string;
  paymentStatus: string;
  operatorName: string;
  timeZone: string;
  locale: string;
  contactName: string;
  voyage: { origin: string; destination: string; departureAt: Date; vessel: string; status: string } | null;
  lines: { description: string; quantity: number; kind: ItemKind; details: string; attributes: Record<string, string | number | boolean> }[];
};

/** Everything a ticket or waybill shows, read under the caller's tenant. */
export async function loadTicket(tx: Tx, tenantId: string, bookingId: string): Promise<TicketData | null> {
  const [detail, config, tenant] = await Promise.all([getBookingDetail(tx, bookingId), getTenantConfig(tx), tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true, timeZone: true, locale: true } })]);
  if (!detail || !tenant) return null;
  const schemaByType = new Map(detail.types.map((t) => [t.id, t.fieldSchema as FieldDef[]]));
  return {
    bookingId: detail.booking.id,
    bookingNo: formatBookingNo(config, detail.booking.bookingNo),
    status: detail.booking.status,
    paymentStatus: detail.invoice?.status ?? "NONE",
    operatorName: tenant.name,
    timeZone: tenant.timeZone,
    locale: tenant.locale,
    contactName: detail.booking.contactName,
    voyage: detail.voyage
      ? { origin: detail.voyage.originName, destination: detail.voyage.destinationName, departureAt: detail.voyage.departureAt, vessel: detail.voyage.vesselName, status: detail.voyage.status }
      : null,
    lines: detail.lines.map((l) => {
      const attributes = (l.attributes ?? {}) as Record<string, string | number | boolean>;
      return { description: l.description, quantity: l.quantity, kind: l.kind as ItemKind, details: describeAttributes(schemaByType.get(l.itemTypeId) ?? [], attributes), attributes };
    }),
  };
}
