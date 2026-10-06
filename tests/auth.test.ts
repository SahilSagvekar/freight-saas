import { afterAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { signSession, verifySession } from "@/lib/session";
import { authenticate } from "@/server/credentials";
import { makeTenant } from "./helpers";

afterAll(closeDb);

describe("authenticate", () => {
  it("accepts the right password, ignoring email case and spacing", async () => {
    const t = await makeTenant("Auth");
    const session = await authenticate(`  ${t.email.toUpperCase()} `, t.password);
    expect(session).toMatchObject({ uid: t.ownerUserId, tid: t.tenantId });
    expect(session?.mid).toBeTruthy();
  });

  it("rejects a wrong password and an unknown email the same way", async () => {
    const t = await makeTenant("Auth");
    expect(await authenticate(t.email, "wrong-password")).toBeNull();
    expect(await authenticate("nobody@example.test", "whatever-1234")).toBeNull();
  });

  it("rejects people whose membership or whose operator has been disabled", async () => {
    const t = await makeTenant("Auth");
    await adminDb().membership.updateMany({ where: { tenantId: t.tenantId }, data: { status: "disabled" } });
    expect(await authenticate(t.email, t.password)).toBeNull();

    const u = await makeTenant("Auth");
    await adminDb().tenant.update({ where: { id: u.tenantId }, data: { status: "suspended" } });
    expect(await authenticate(u.email, u.password)).toBeNull();
  });
});

describe("session tokens", () => {
  it("round-trips a signed session and rejects tampering or garbage", async () => {
    const token = await signSession({ uid: "u1", tid: "t1", mid: "m1" });
    expect(await verifySession(token)).toEqual({ uid: "u1", tid: "t1", mid: "m1" });

    const [h, p, s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ uid: "u1", tid: "OTHER", mid: "m1" })).toString("base64url")}.${s}`;
    expect(await verifySession(forged)).toBeNull();
    expect(await verifySession(`${h}.${p}.AAAA`)).toBeNull();
    expect(await verifySession("not-a-token")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});

describe("rateLimit", () => {
  it("blocks after the limit and recovers after the window", () => {
    const key = "test-key";
    resetRateLimit(key);
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, t0).allowed).toBe(true);
    const blocked = rateLimit(key, 3, 60_000, t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(rateLimit(key, 3, 60_000, t0 + 61_000).allowed).toBe(true);
  });
});
