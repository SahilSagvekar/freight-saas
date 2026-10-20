import { describe, expect, it } from "vitest";
import { productionEnvProblems } from "@/lib/env";
import { buildEnvelope, cleanPath, parseDsn } from "@/lib/monitor";

describe("production env check", () => {
  const good = { DATABASE_URL: "postgres://app@h/db", ADMIN_DATABASE_URL: "postgres://owner@h/db", SESSION_SECRET: "x".repeat(32), APP_URL: "https://app.example.com" };
  it("accepts a complete environment", () => expect(productionEnvProblems(good)).toEqual([]));
  it("flags each missing or unsafe value", () => {
    expect(productionEnvProblems({})).toHaveLength(4);
    expect(productionEnvProblems({ ...good, SESSION_SECRET: "short" })).toEqual(["SESSION_SECRET must be at least 32 characters"]);
    expect(productionEnvProblems({ ...good, APP_URL: "http://x.com" })[0]).toMatch(/https/);
    expect(productionEnvProblems({ ...good, ADMIN_DATABASE_URL: good.DATABASE_URL })[0]).toMatch(/same/);
  });

  it("wants both Turnstile keys or neither", () => {
    expect(productionEnvProblems({ ...good, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })).toEqual([]);
    expect(productionEnvProblems({ ...good, TURNSTILE_SITE_KEY: "site" })[0]).toMatch(/together/);
    expect(productionEnvProblems({ ...good, TURNSTILE_SECRET_KEY: "secret" })[0]).toMatch(/together/);
  });

  it("wants a working two-factor secret whenever platform admins are listed", () => {
    expect(productionEnvProblems({ ...good, PLATFORM_ADMIN_EMAILS: "me@example.com" })[0]).toMatch(/two-factor/);
    expect(productionEnvProblems({ ...good, PLATFORM_ADMIN_EMAILS: "me@example.com", PLATFORM_ADMIN_TOTP_SECRET: "0189" })[0]).toMatch(/base32/);
    expect(productionEnvProblems({ ...good, PLATFORM_ADMIN_EMAILS: "me@example.com", PLATFORM_ADMIN_TOTP_SECRET: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" })).toEqual([]);
    expect(productionEnvProblems({ ...good, PLATFORM_ADMIN_EMAILS: "  " })).toEqual([]);
  });
});

describe("error reporting", () => {
  it("reads a Sentry DSN, and ignores nonsense", () => {
    expect(parseDsn("https://abc123@o1.ingest.sentry.io/456")).toEqual({ endpoint: "https://o1.ingest.sentry.io/api/456/envelope/", key: "abc123" });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://nokey.example.com/1")).toBeNull();
  });

  it("removes queries and ids from paths", () => {
    expect(cleanPath("/app/bookings/0f8fad5b-d9cb-469f-a165-70867728950e?token=secret")).toBe("/app/bookings/:id");
  });

  it("builds an envelope without leaking the query string", () => {
    const dsn = parseDsn("https://k@sentry.example.com/9")!;
    const body = buildEnvelope({ message: "boom", source: "server", route: "/set-password?token=SECRET" }, dsn, new Date("2026-01-01T00:00:00Z"));
    const lines = body.split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2]!).exception.values[0].value).toBe("boom");
    expect(body).not.toContain("SECRET");
  });
});

describe("email templates", () => {
  it("escapes names so nobody can inject markup into an invite", async () => {
    const { inviteEmail, resetEmail } = await import("@/lib/email-templates");
    const e = inviteEmail({ name: '<img src=x onerror=alert(1)>', operator: "Blue & Co", inviter: "Ann", url: "https://app.test/set-password?token=a&b=1", hours: 72 });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("Blue &amp; Co");
    expect(e.text).toContain("https://app.test/set-password?token=a&b=1");
    expect(resetEmail({ name: "Ann", url: "https://x.test/y", hours: 72 }).subject).toMatch(/Reset/);
  });
});

describe("plans", () => {
  it("has unique ids and rising limits", async () => {
    const { PLANS, planById } = await import("@/lib/plans");
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
    expect(PLANS[1]!.maxVessels).toBeGreaterThan(PLANS[0]!.maxVessels);
    expect(planById("nope")).toBeUndefined();
  });
});

import { billingAccess, encodeForm, mapStripeStatus, planLimitProblem, verifyStripeSignature } from "@/lib/billing";
import { createHmac } from "node:crypto";

describe("billing access", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const base = { trialEndsAt: null, currentPeriodEnd: null, pastDueSince: null };
  const d = (days: number) => new Date(now.getTime() + days * 86_400_000);

  it("comped and active always sell", () => {
    expect(billingAccess({ ...base, status: "comped" }, now)).toEqual({ level: "full", banner: null });
    expect(billingAccess({ ...base, status: "active" }, now).level).toBe("full");
  });
  it("trial sells until it ends, then goes read-only", () => {
    expect(billingAccess({ ...base, status: "trialing", trialEndsAt: d(10) }, now)).toMatchObject({ level: "full", banner: { tone: "info" } });
    expect(billingAccess({ ...base, status: "trialing", trialEndsAt: d(2) }, now).banner?.tone).toBe("warning");
    expect(billingAccess({ ...base, status: "trialing", trialEndsAt: d(-1) }, now).level).toBe("readonly");
    expect(billingAccess({ ...base, status: "trialing" }, now).level).toBe("readonly");
  });
  it("past due keeps a one-week grace, then pauses selling", () => {
    expect(billingAccess({ ...base, status: "past_due", pastDueSince: d(-3) }, now).level).toBe("full");
    expect(billingAccess({ ...base, status: "past_due", pastDueSince: d(-8) }, now).level).toBe("readonly");
  });
  it("canceled keeps access to the end of the paid period", () => {
    expect(billingAccess({ ...base, status: "canceled", currentPeriodEnd: d(5) }, now).level).toBe("full");
    expect(billingAccess({ ...base, status: "canceled", currentPeriodEnd: d(-1) }, now).level).toBe("readonly");
    expect(billingAccess({ ...base, status: "canceled" }, now).level).toBe("readonly");
  });
});

describe("billing helpers", () => {
  it("maps Stripe statuses", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete")).toBeNull();
  });
  it("enforces plan limits, but not for comped operators", () => {
    expect(planLimitProblem("starter", "vessel", 1)).toMatch(/1 vessel/);
    expect(planLimitProblem("starter", "vessel", 0)).toBeNull();
    expect(planLimitProblem("operator", "user", 40)).toMatch(/40 people/);
    expect(planLimitProblem(null, "vessel", 999)).toBeNull();
  });
  it("verifies Stripe signatures and rejects tampering and replays", () => {
    const body = '{"id":"evt_1"}';
    const t = 1_800_000_000;
    const sig = createHmac("sha256", "whsec_x").update(`${t}.${body}`).digest("hex");
    const header = `t=${t},v1=${sig}`;
    expect(verifyStripeSignature(body, header, "whsec_x", t + 10)).toBe(true);
    expect(verifyStripeSignature(body + " ", header, "whsec_x", t + 10)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_other", t + 10)).toBe(false);
    expect(verifyStripeSignature(body, header, "whsec_x", t + 3600)).toBe(false);
    expect(verifyStripeSignature(body, null, "whsec_x", t)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=zz`, "whsec_x", t)).toBe(false);
  });
  it("form-encodes nested Stripe parameters", () => {
    expect(encodeForm({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { tenantId: "a b" } })).toBe(
      "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5BtenantId%5D=a%20b",
    );
  });
});

describe("platform admin list", () => {
  it("matches emails case-insensitively and lets nobody in when unset", async () => {
    const { isPlatformAdmin } = await import("@/lib/platform-admin");
    expect(isPlatformAdmin("Sahil@Example.com", "sahil@example.com, other@x.com")).toBe(true);
    expect(isPlatformAdmin("stranger@x.com", "sahil@example.com")).toBe(false);
    expect(isPlatformAdmin("anyone@x.com", "")).toBe(false);
    expect(isPlatformAdmin(null, "a@b.com")).toBe(false);
  });
});

describe("regions", () => {
  it("only offers real currencies and time zones", async () => {
    const { REGIONS } = await import("@/lib/regions");
    for (const r of REGIONS) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: r.timeZone })).not.toThrow();
      expect(() => new Intl.NumberFormat(r.locale, { style: "currency", currency: r.currency })).not.toThrow();
    }
    expect(new Set(REGIONS.map((r) => r.code)).size).toBe(REGIONS.length);
  });
});
