import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpAt, totpSecretProblem, totpUri, verifyTotp } from "@/lib/totp";

// RFC 6238 appendix B: the secret is the ASCII string "12345678901234567890", SHA-1.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("matches the published test vectors", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpAt(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totpAt(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totpAt(RFC_SECRET, 1_234_567_890_000, 8)).toBe("89005924");
    expect(totpAt(RFC_SECRET, 20_000_000_000_000, 8)).toBe("65353130");
  });

  it("produces the 6-digit code authenticator apps show", () => {
    expect(totpAt(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
  });

  it("accepts the current code and one step either side, but not older or newer", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now + 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 90_000), now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now + 90_000), now)).toBe(false);
  });

  it("rejects wrong, malformed and empty codes", () => {
    const now = 1_700_000_000_000;
    const right = totpAt(RFC_SECRET, now);
    const wrong = right === "000000" ? "000001" : "000000";
    expect(verifyTotp(RFC_SECRET, wrong, now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "1234567", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBe(false);
    expect(verifyTotp("not base32!!", right, now)).toBe(false);
  });

  it("ignores spaces in the code, as people type 123 456", () => {
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });

  it("round-trips base32 and tolerates grouping and lower case", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7, 8]);
    expect(base32Decode(base32Encode(bytes))?.equals(bytes)).toBe(true);
    expect(base32Decode("gezd gnbv-gy3t qojq")?.toString()).toBe("1234567890");
    expect(base32Decode("1!?")).toBeNull();
    expect(base32Decode("")).toBeNull();
  });

  it("generates usable secrets and flags unusable ones", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(totpSecretProblem(secret)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret))).toBe(true);
    expect(totpSecretProblem(undefined)).toMatch(/no secret/);
    expect(totpSecretProblem("0189")).toMatch(/base32/);
    expect(totpSecretProblem("ABCDEFGH")).toMatch(/too short/);
  });

  it("builds an otpauth address for authenticator apps", () => {
    const uri = totpUri("ABCDEFGHIJKLMNOP", "me@example.com", "Harborline");
    expect(uri.startsWith("otpauth://totp/Harborline%3Ame%40example.com?")).toBe(true);
    expect(uri).toContain("secret=ABCDEFGHIJKLMNOP");
    expect(uri).toContain("issuer=Harborline");
  });
});
