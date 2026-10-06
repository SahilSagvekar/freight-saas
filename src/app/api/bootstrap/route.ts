import { NextResponse } from "next/server";
import { withTenant } from "@/db";
import { can, getAuth } from "@/server/auth";
import { bookingFormData } from "@/server/queries";

/** Reference data the ticket desk caches on the device so it can price and book without a connection. */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(auth, "booking.create")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const data = await withTenant(auth.tenantId, bookingFormData);
  return NextResponse.json({ data, currency: auth.tenant.baseCurrency, locale: auth.tenant.locale, tenantId: auth.tenantId, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
