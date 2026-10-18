import { NextResponse } from "next/server";
import { withTenant } from "@/db";
import { inquiriesCsv } from "@/lib/freight-csv";
import { can, getAuth } from "@/server/auth";
import { listInquiries } from "@/server/inquiries";
import { formatInquiryNo } from "@/server/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Sign in first", { status: 401 });
  if (!can(auth, "booking.create")) return new NextResponse("Not allowed", { status: 403 });
  const rows = await withTenant(auth.tenantId, (tx) => listInquiries(tx, { limit: 5000 }));
  return new NextResponse(inquiriesCsv(rows, formatInquiryNo), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inquiries.csv"`, "Cache-Control": "no-store" },
  });
}
