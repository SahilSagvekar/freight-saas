import { NextResponse } from "next/server";
import { syncRequestSchema } from "@/lib/schemas";
import { can, getAuth } from "@/server/auth";
import { applySyncOps } from "@/server/sync";

/** Receives queued offline sales. Safe to call repeatedly: each operation is applied exactly once. */
export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(auth, "booking.create")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues.slice(0, 3) }, { status: 400 });

  const results = await applySyncOps({ tenantId: auth.tenantId, actorId: auth.userId }, parsed.data);
  return NextResponse.json({ results });
}
