import { encodeForm } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";

/**
 * A thin Stripe client over their REST API (no SDK), switched on by STRIPE_SECRET_KEY.
 * Subscriptions are charged to the platform's account; ticket payments are charged to each operator's own
 * connected account (pass `account`), so ticket money never passes through the platform.
 */
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
export const connectConfigured = () => stripeConfigured() && Boolean(process.env.STRIPE_CONNECT_CLIENT_ID);

export class StripeError extends Error {}

async function call<T>(path: string, params: Record<string, unknown> = {}, opts: { account?: string; method?: "GET" | "POST"; idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not configured");
  const method = opts.method ?? "POST";
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (opts.account) headers["Stripe-Account"] = opts.account;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: method === "POST" ? encodeForm(params) : undefined, signal: AbortSignal.timeout(15000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

export const priceIdFor = (plan: PlanId): string | undefined => (plan === "starter" ? process.env.STRIPE_PRICE_STARTER : process.env.STRIPE_PRICE_OPERATOR);
export const planForPriceId = (priceId: string | undefined): PlanId | null => (priceId && priceId === process.env.STRIPE_PRICE_STARTER ? "starter" : priceId && priceId === process.env.STRIPE_PRICE_OPERATOR ? "operator" : null);

export async function createSubscriptionCheckout(p: { tenantId: string; plan: PlanId; email: string; customerId?: string | null; baseUrl: string }): Promise<string> {
  const price = priceIdFor(p.plan);
  if (!price) throw new StripeError("This plan has no Stripe price configured");
  const session = await call<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    client_reference_id: p.tenantId,
    ...(p.customerId ? { customer: p.customerId } : { customer_email: p.email }),
    line_items: [{ price, quantity: 1 }],
    metadata: { tenantId: p.tenantId, plan: p.plan },
    subscription_data: { metadata: { tenantId: p.tenantId, plan: p.plan } },
    success_url: `${p.baseUrl}/app/billing?done=1`,
    cancel_url: `${p.baseUrl}/app/billing`,
    allow_promotion_codes: true,
  });
  return session.url;
}

export async function createPortalSession(customerId: string, baseUrl: string): Promise<string> {
  const session = await call<{ url: string }>("/billing_portal/sessions", { customer: customerId, return_url: `${baseUrl}/app/billing` });
  return session.url;
}

/** A one-off card payment for a booking, charged straight to the operator's connected account. */
export async function createTicketCheckout(p: { account: string; bookingId: string; bookingNo: string; amount: number; currency: string; email?: string; successUrl: string; cancelUrl: string; description: string }): Promise<{ id: string; url: string }> {
  return call<{ id: string; url: string }>(
    "/checkout/sessions",
    {
      mode: "payment",
      client_reference_id: p.bookingId,
      ...(p.email ? { customer_email: p.email } : {}),
      line_items: [{ price_data: { currency: p.currency.toLowerCase(), unit_amount: p.amount, product_data: { name: `Tickets ${p.bookingNo}`, description: p.description.slice(0, 250) } }, quantity: 1 }],
      metadata: { bookingId: p.bookingId },
      payment_intent_data: { metadata: { bookingId: p.bookingId } },
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { account: p.account, idempotencyKey: `ticket-${p.bookingId}` },
  );
}

/** Finishes "Connect with Stripe": swaps the one-time code from the redirect for the operator's account id. */
export async function exchangeConnectCode(code: string): Promise<string> {
  const res = await call<{ stripe_user_id?: string }>("/oauth/token", { grant_type: "authorization_code", code });
  if (!res.stripe_user_id) throw new StripeError("Stripe did not return an account");
  return res.stripe_user_id;
}

export const connectAuthorizeUrl = (state: string, redirectUri: string) =>
  `https://connect.stripe.com/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id: process.env.STRIPE_CONNECT_CLIENT_ID ?? "", scope: "read_write", state, redirect_uri: redirectUri }).toString()}`;
