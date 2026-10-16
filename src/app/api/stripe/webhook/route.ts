import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/billing";
import { captureException } from "@/lib/monitor";
import { handleStripeEvent, type StripeEvent } from "@/server/billing";

/**
 * Stripe calls this for subscription changes (platform endpoint) and for ticket payments on operators' accounts
 * (Connect endpoint). Each has its own signing secret; either is accepted.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const header = request.headers.get("stripe-signature");
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s));
  if (!secrets.some((secret) => verifyStripeSignature(body, header, secret))) return new NextResponse("Bad signature", { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return new NextResponse("Bad body", { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (e) {
    await captureException(e, { route: "/api/stripe/webhook", extra: { type: event.type } });
    return new NextResponse("Handler failed", { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
