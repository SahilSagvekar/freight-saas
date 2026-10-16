import { NextResponse } from "next/server";
import { appDb } from "@/db";

export const dynamic = "force-dynamic";

/** For uptime monitors and load balancers. Says only up or down, never why. */
export async function GET() {
  try {
    await appDb().$queryRaw`select 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
