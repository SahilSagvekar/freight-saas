import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { importTemplateRows } from "@/lib/shipment-import";
import { getAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return new NextResponse("Sign in first", { status: 401 });
  return new NextResponse(toCsv(importTemplateRows()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="shipment-import-template.csv"`, "Cache-Control": "no-store" },
  });
}
