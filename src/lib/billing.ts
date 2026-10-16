import { createHmac, timingSafeEqual } from "node:crypto";
import { planById, type PlanId } from "./plans";

export type BillingStatus = "comped" | "trialing" | "active" | "past_due" | "canceled";
export const BILLING_STATUSES: BillingStatus[] = ["comped", "trialing", "active", "past_due", "canceled"];

export type BillingState = {
  status: BillingStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
};

/** After a failed payment people keep full access this long, so one declined card doesn't stop a morning's sailings. */
export const PAST_DUE_GRACE_DAYS = 7;
const DAY = 86_400_000;

export type Access = {
  /** full: everything works. readonly: they can look and export but not sell. */
  level: "full" | "readonly";
  banner: { tone: "info" | "warning" | "error"; text: string } | null;
};

export function billingAccess(s: BillingState, now = new Date()): Access {
  const days = (to: Date) => Math.max(0, Math.ceil((to.getTime() - now.getTime()) / DAY));
  switch (s.status) {
    case "comped":
    case "active":
      return { level: "full", banner: null };
    case "trialing": {
      if (!s.trialEndsAt || now >= s.trialEndsAt) return { level: "readonly", banner: { tone: "error", text: "Your free trial has ended. Subscribe to keep selling tickets. Your data is safe." } };
      const left = days(s.trialEndsAt);
      return { level: "full", banner: { tone: left <= 3 ? "warning" : "info", text: `Free trial: ${left} day${left === 1 ? "" : "s"} left.` } };
    }
    case "past_due": {
      const since = s.pastDueSince ?? now;
      const graceEnds = new Date(since.getTime() + PAST_DUE_GRACE_DAYS * DAY);
      if (now >= graceEnds) return { level: "readonly", banner: { tone: "error", text: "Your last payment failed, so selling is paused. Update your card to resume." } };
      const left = days(graceEnds);
      return { level: "full", banner: { tone: "warning", text: `Your last payment failed. Update your card within ${left} day${left === 1 ? "" : "s"} to avoid interruption.` } };
    }
    case "canceled": {
      if (s.currentPeriodEnd && now < s.currentPeriodEnd) return { level: "full", banner: { tone: "warning", text: `Your subscription has ended and access stops in ${days(s.currentPeriodEnd)} day(s).` } };
      return { level: "readonly", banner: { tone: "error", text: "Your subscription has ended. Resubscribe to keep selling tickets. Your data is safe." } };
    }
  }
}

/** Our status for a Stripe subscription status; null means "leave things as they are". */
export function mapStripeStatus(stripeStatus: string): BillingStatus | null {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return null; // incomplete, paused: wait for the next event
  }
}

/** The message to show when a plan's limit is reached, or null when there is room. `plan` null means no limits (comped). */
export function planLimitProblem(plan: PlanId | string | null, kind: "vessel" | "user", current: number): string | null {
  if (plan === null) return null;
  const p = planById(plan);
  if (!p) return null;
  if (kind === "vessel" && current >= p.maxVessels) return `Your ${p.name} plan includes ${p.maxVessels} ${p.maxVessels === 1 ? "vessel" : "vessels"}. Upgrade to add more.`;
  if (kind === "user" && current >= p.maxUsers) return `Your ${p.name} plan includes up to ${p.maxUsers} people. Upgrade to add more.`;
  return null;
}

/** Checks Stripe's `Stripe-Signature` header (`t=…,v1=…`) over the raw body. Rejects old timestamps to block replays. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Stripe wants form-encoded bodies with bracketed keys for nesting: line_items[0][price]=… */
export function encodeForm(value: Record<string, unknown>, prefix = ""): string {
  const out: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(v)) v.forEach((item, i) => out.push(typeof item === "object" && item !== null ? encodeForm(item as Record<string, unknown>, `${name}[${i}]`) : `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else if (typeof v === "object") out.push(encodeForm(v as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  }
  return out.filter(Boolean).join("&");
}
