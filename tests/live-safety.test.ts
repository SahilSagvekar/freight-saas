import { describe, expect, it } from "vitest";
import {
  DEMO_SEED_FLAG_VALUE,
  DEMO_TENANT_SLUG,
  demoSeedBlockedReason,
  isLocalDatabase,
  testDatabaseBlockedReason,
} from "@/lib/live-guard";
import { passwordProblem } from "@/lib/password";
import { passwordFingerprint, signChoiceToken, signSetupToken, verifyChoiceToken, verifySetupToken } from "@/lib/tokens";
import { signSession, verifySession } from "@/lib/session";

describe("isLocalDatabase", () => {
  it("only accepts loopback hosts", () => {
    expect(isLocalDatabase("postgres://postgres@127.0.0.1:54320/freight")).toBe(true);
    expect(isLocalDatabase("postgres://u:p@localhost:5432/x")).toBe(true);
    expect(isLocalDatabase("postgres://u:p@db.example.com:5432/x")).toBe(false);
    expect(isLocalDatabase("not a url")).toBe(false);
  });
});

describe("demo seed guard", () => {
  const local = "postgres://postgres@127.0.0.1:54320/freight";
  const hosted = "postgres://postgres:pw@db.example.com:5432/demo";

  it("allows an empty or demo-only local database", () => {
    expect(demoSeedBlockedReason({ adminUrl: local, flag: undefined, existingSlugs: [] })).toBeNull();
    expect(demoSeedBlockedReason({ adminUrl: local, flag: undefined, existingSlugs: [DEMO_TENANT_SLUG] })).toBeNull();
  });

  it("refuses any database that holds a real operator, even with the flag", () => {
    const reason = demoSeedBlockedReason({ adminUrl: local, flag: DEMO_SEED_FLAG_VALUE, existingSlugs: [DEMO_TENANT_SLUG, "island-ferries"] });
    expect(reason).toContain("island-ferries");
  });

  it("refuses a hosted database unless the exact flag value is set", () => {
    expect(demoSeedBlockedReason({ adminUrl: hosted, flag: undefined, existingSlugs: [] })).toContain("not local");
    expect(demoSeedBlockedReason({ adminUrl: hosted, flag: "yes", existingSlugs: [] })).toContain("not local");
    expect(demoSeedBlockedReason({ adminUrl: hosted, flag: DEMO_SEED_FLAG_VALUE, existingSlugs: [] })).toBeNull();
  });
});

describe("test database guard", () => {
  it("accepts only the local freight_test database", () => {
    expect(testDatabaseBlockedReason("postgres://postgres@127.0.0.1:54329/freight_test")).toBeNull();
    expect(testDatabaseBlockedReason("postgres://postgres@127.0.0.1:54320/freight")).toContain("freight_test");
    expect(testDatabaseBlockedReason("postgres://u:p@db.example.com:5432/freight_test")).toContain("local");
    expect(testDatabaseBlockedReason(undefined)).toContain("no database URL");
  });
});

describe("password rules", () => {
  it("rejects short, over-long and repeated-character passwords", () => {
    expect(passwordProblem("short")).toMatch(/at least/);
    expect(passwordProblem("a".repeat(80))).toMatch(/72/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordProblem("a decent passphrase")).toBeNull();
  });
});

describe("setup and choice tokens", () => {
  it("round-trips a setup token and ties it to the password it was issued for", async () => {
    const fp = passwordFingerprint("hash-one");
    const token = await signSetupToken({ uid: "user-1", fp });
    expect(await verifySetupToken(token)).toEqual({ uid: "user-1", fp });
    expect(passwordFingerprint("hash-two")).not.toBe(fp);
  });

  it("rejects garbage and tokens of the wrong kind", async () => {
    expect(await verifySetupToken("garbage")).toBeNull();
    expect(await verifySetupToken(undefined)).toBeNull();
    const choice = await signChoiceToken({ uid: "u", options: [{ mid: "m", tid: "t" }] });
    const session = await signSession({ uid: "u", tid: "t", mid: "m" });
    expect(await verifySetupToken(choice)).toBeNull();
    expect(await verifySetupToken(session)).toBeNull();
    expect(await verifyChoiceToken(session)).toBeNull();
    const setup = await signSetupToken({ uid: "u", fp: "f" });
    expect(await verifySession(setup)).toBeNull();
    expect(await verifySession(choice)).toBeNull();
    expect(await verifyChoiceToken(setup)).toBeNull();
  });

  it("round-trips the operator choice", async () => {
    const options = [{ mid: "m1", tid: "t1" }, { mid: "m2", tid: "t2" }];
    const token = await signChoiceToken({ uid: "user-1", options });
    expect(await verifyChoiceToken(token)).toEqual({ uid: "user-1", options });
  });
});

describe("session invalidation", () => {
  it("rejects sessions issued before the cut-off, allows those after", async () => {
    const { sessionStillValid } = await import("@/lib/session");
    const cutoff = new Date("2026-10-14T10:00:00Z");
    const t = Math.floor(cutoff.getTime() / 1000);
    expect(sessionStillValid(t - 1, cutoff)).toBe(false);
    expect(sessionStillValid(t, cutoff)).toBe(true);
    expect(sessionStillValid(t + 100, cutoff)).toBe(true);
    expect(sessionStillValid(5, new Date("1970-01-01T00:00:00Z"))).toBe(true);
  });
});
