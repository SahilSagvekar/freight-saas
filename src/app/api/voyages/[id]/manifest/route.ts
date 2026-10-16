import { NextResponse, type NextRequest } from "next/server";
import { withTenant } from "@/db";
import { toCsv } from "@/lib/csv";
import { can, getAuth } from "@/server/auth";
import { getVoyage, voyageManifest } from "@/server/queries";
import { formatBookingNo, getTenantConfig } from "@/server/shared";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/voyages/[id]/manifest">) {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Sign in first", { status: 401 });
  if (!can(auth, "booking.view")) return new NextResponse("Not allowed", { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const data = await withTenant(auth.tenantId, async (tx) => ({ v: await getVoyage(tx, id), rows: await voyageManifest(tx, id), config: await getTenantConfig(tx) }));
  if (!data.v) return new NextResponse("Not found", { status: 404 });
  const csv = toCsv([
    ["Booking", "Contact", "Type", "Qty", "Item", "Details", "Status", "Received by"],
    ...data.rows.map((r) => [formatBookingNo(data.config, r.bookingNo), r.contactName, r.kind, r.quantity, r.description, Object.entries(r.attributes).map(([k, v]) => `${k}=${v}`).join("; "), r.status, r.receivedBy]),
  ]);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="manifest-${data.v.originName}-${data.v.destinationName}.csv"`.replace(/[^\x20-\x7E]/g, "_"), "Cache-Control": "no-store" } });
}
