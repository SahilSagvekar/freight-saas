import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { SESSION_COOKIE, secretKey } from "@/lib/session";
import { totpSecretProblem } from "@/lib/totp";

/**
 * Second factor for the platform console. /admin can suspend any operator and mint a sign-in link for any owner, so a
 * stolen admin password alone must not be enough.
 *
 * PLATFORM_ADMIN_TOTP_SECRET holds the shared secret (create one with `npm run admin:2fa`). In production the console
 * stays closed (404) until it is set. Outside production it is optional, so local development needs nothing extra.
 * After a correct code the browser gets a 12-hour cookie that is tied to that exact sign-in session, so signing out,
 * signing in again or "sign out everywhere" asks for a code again.
 */
export const ADMIN_2FA_COOKIE = "fs_admin_2fa";
export const ADMIN_2FA_TTL_SECONDS = 12 * 60 * 60;
const PURPOSE = "admin-2fa";

export const adminTotpSecret = () => process.env.PLATFORM_ADMIN_TOTP_SECRET?.trim() || null;

/** True when /admin needs a code: always in production, and in development whenever a secret is configured. */
export const adminTwoFactorRequired = () => process.env.NODE_ENV === "production" || adminTotpSecret() !== null;

/** Why the second factor can't work right now (so the console stays closed), or null when it is usable. */
export function adminTwoFactorProblem(): string | null {
  if (!adminTwoFactorRequired()) return null;
  const problem = totpSecretProblem(adminTotpSecret());
  return problem ? `PLATFORM_ADMIN_TOTP_SECRET: ${problem}` : null;
}

const sessionFingerprint = (sessionToken: string | undefined) => createHash("sha256").update(sessionToken ?? "").digest("hex").slice(0, 24);

export async function issueAdminTwoFactorCookie(userId: string): Promise<void> {
  const store = await cookies();
  const token = await new SignJWT({ uid: userId, sh: sessionFingerprint(store.get(SESSION_COOKIE)?.value), purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_2FA_TTL_SECONDS}s`)
    .sign(secretKey());
  store.set(ADMIN_2FA_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: ADMIN_2FA_TTL_SECONDS });
}

/** True when this browser passed the code check for this person's current sign-in session. */
export async function hasAdminTwoFactor(userId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_2FA_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.purpose === PURPOSE && payload.uid === userId && payload.sh === sessionFingerprint(store.get(SESSION_COOKIE)?.value);
  } catch {
    return false;
  }
}
