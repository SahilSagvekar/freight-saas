import { NextResponse } from "next/server";
import { withTenant } from "@/db";
import { shipmentsCsv } from "@/lib/freight-csv";
import { can, getAuth } from "@/server/auth";
import { formatShipmentNo } from "@/server/shared";
import { listShipments } from "@/server/shipments";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Sign in first", { status: 401 });
  if (!can(auth, "booking.view")) return new NextResponse("Not allowed", { status: 403 });
  const rows = await withTenant(auth.tenantId, (tx) => listShipments(tx, { limit: 5000 }));
  return new NextResponse(shipmentsCsv(rows, formatShipmentNo), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="shipments.csv"`, "Cache-Control": "no-store" },
  });
}
