import { NextResponse, type NextRequest } from "next/server";
import { withTenant } from "@/db";
import { localDateString } from "@/lib/tz";
import { can, getAuth } from "@/server/auth";
import { dailyReport } from "@/server/reports";
import { dailyReportCsv } from "@/server/reports-csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Sign in first", { status: 401 });
  if (!can(auth, "invoice.view")) return new NextResponse("Not allowed", { status: 403 });
  const date = request.nextUrl.searchParams.get("date") ?? localDateString(new Date(), auth.tenant.timeZone);
  const report = await withTenant(auth.tenantId, (tx) => dailyReport(tx, date, auth.tenant.timeZone));
  if (!report) return new NextResponse("Use a date like 2026-10-14", { status: 400 });
  return new NextResponse(dailyReportCsv(report, auth.tenant.baseCurrency), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="daily-report-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
