import { describe, expect, it } from "vitest";
import { clientIpFrom, UNKNOWN_IP } from "@/lib/client-ip";

const headersOf = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null;

describe("client IP for throttling", () => {
  it("uses the right-most x-forwarded-for entry, which our own proxy wrote, not the left-most one the client chose", () => {
    const get = headersOf({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIpFrom(get, {})).toBe("203.0.113.9");
  });

  it("cannot be moved to a fresh bucket by sending a forged header", () => {
    const real = "203.0.113.9";
    const a = clientIpFrom(headersOf({ "x-forwarded-for": `1.1.1.1, ${real}` }), {});
    const b = clientIpFrom(headersOf({ "x-forwarded-for": `2.2.2.2, 3.3.3.3, ${real}` }), {});
    expect(a).toBe(real);
    expect(b).toBe(real);
  });

  it("counts trusted hops from the right when several proxies are in front", () => {
    const get = headersOf({ "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.2" });
    expect(clientIpFrom(get, { TRUSTED_PROXY_HOPS: "2" })).toBe("198.51.100.7");
    expect(clientIpFrom(get, { TRUSTED_PROXY_HOPS: "9" })).toBe("6.6.6.6");
    expect(clientIpFrom(get, { TRUSTED_PROXY_HOPS: "nonsense" })).toBe("10.0.0.2");
  });

  it("uses only the configured header when CLIENT_IP_HEADER is set", () => {
    const get = headersOf({ "cf-connecting-ip": "198.51.100.20", "x-forwarded-for": "6.6.6.6" });
    expect(clientIpFrom(get, { CLIENT_IP_HEADER: "CF-Connecting-IP" })).toBe("198.51.100.20");
    expect(clientIpFrom(headersOf({ "x-forwarded-for": "6.6.6.6" }), { CLIENT_IP_HEADER: "cf-connecting-ip" })).toBe(UNKNOWN_IP);
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIpFrom(headersOf({ "x-real-ip": "203.0.113.5" }), {})).toBe("203.0.113.5");
    expect(clientIpFrom(headersOf({}), {})).toBe(UNKNOWN_IP);
  });

  it("rejects values that are not shaped like an address", () => {
    expect(clientIpFrom(headersOf({ "x-forwarded-for": "<script>alert(1)</script>" }), {})).toBe(UNKNOWN_IP);
    expect(clientIpFrom(headersOf({ "x-forwarded-for": "a".repeat(200) }), {})).toBe(UNKNOWN_IP);
  });

  it("understands IPv6, with or without brackets", () => {
    expect(clientIpFrom(headersOf({ "x-forwarded-for": "[2001:db8::1]" }), {})).toBe("2001:db8::1");
    expect(clientIpFrom(headersOf({ "x-forwarded-for": "2001:DB8::1" }), {})).toBe("2001:db8::1");
  });
});
