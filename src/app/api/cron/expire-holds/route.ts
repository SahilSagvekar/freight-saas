import { NextResponse } from "next/server";
import { expireUnpaidHolds } from "@/server/public-booking";

export const dynamic = "force-dynamic";

/** Called every few minutes by the scheduled workflow. Needs `Authorization: Bearer $CRON_SECRET`. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ expired: await expireUnpaidHolds() });
}
