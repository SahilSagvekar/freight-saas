import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "fs_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  /** user id */
  uid: string;
  /** tenant id */
  tid: string;
  /** membership id */
  mid: string;
};

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";
let warned = false;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[auth] SESSION_SECRET not set; using an insecure development secret");
  }
  return new TextEncoder().encode(DEV_SECRET);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.tid !== "string" || typeof payload.mid !== "string") return null;
    return { uid: payload.uid, tid: payload.tid, mid: payload.mid };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
