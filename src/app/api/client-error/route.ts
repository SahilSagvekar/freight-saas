import { NextResponse, type NextRequest } from "next/server";
import { captureException, cleanPath } from "@/lib/monitor";
import { throttle } from "@/server/throttle";

/** Receives errors from browsers and forwards them. Small, capped and throttled, since anyone can call it. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await throttle(`client-error:${ip}`, 20, 10 * 60 * 1000)).allowed) return new NextResponse(null, { status: 429 });
  let body: { message?: unknown; stack?: unknown; path?: unknown };
  try {
    const text = await request.text();
    if (text.length > 8000) return new NextResponse(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const err = new Error(typeof body.message === "string" ? body.message.slice(0, 500) : "Browser error");
  if (typeof body.stack === "string") err.stack = body.stack.slice(0, 4000);
  await captureException(err, { route: cleanPath(typeof body.path === "string" ? body.path : undefined), source: "browser" });
  return new NextResponse(null, { status: 204 });
}
