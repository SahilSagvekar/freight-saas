import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { secretKey } from "./session";

// Short-lived signed tokens for two flows. Both carry a `purpose` claim, so neither can be used as a login
// session (sessions have no purpose) and neither can stand in for the other.

const SET_PASSWORD = "set-password";
const CHOOSE_OPERATOR = "choose-operator";

export const SETUP_LINK_TTL_HOURS = 72;

/**
 * A short fingerprint of the current password hash. A setup link carries it and is only honoured while it still
 * matches, so the link stops working the moment the password is set. No extra table is needed for "single use".
 */
export const passwordFingerprint = (passwordHash: string) =>
  createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);

export async function signSetupToken(input: { uid: string; fp: string }, ttlHours = SETUP_LINK_TTL_HOURS): Promise<string> {
  return new SignJWT({ uid: input.uid, fp: input.fp, purpose: SET_PASSWORD })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(secretKey());
}

export async function verifySetupToken(token: string | null | undefined): Promise<{ uid: string; fp: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== SET_PASSWORD || typeof payload.uid !== "string" || typeof payload.fp !== "string") return null;
    return { uid: payload.uid, fp: payload.fp };
  } catch {
    return null;
  }
}

/** One operator a signed-in person may enter. */
export type OperatorChoice = { mid: string; tid: string };

/** Issued after the password was accepted for someone who works for several operators; lets them pick one without retyping it. */
export async function signChoiceToken(input: { uid: string; options: OperatorChoice[] }): Promise<string> {
  return new SignJWT({ uid: input.uid, options: input.options, purpose: CHOOSE_OPERATOR })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
}

export async function verifyChoiceToken(token: string | null | undefined): Promise<{ uid: string; options: OperatorChoice[] } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== CHOOSE_OPERATOR || typeof payload.uid !== "string" || !Array.isArray(payload.options)) return null;
    const options = payload.options.filter(
      (o): o is OperatorChoice => !!o && typeof o === "object" && typeof (o as OperatorChoice).mid === "string" && typeof (o as OperatorChoice).tid === "string",
    );
    return { uid: payload.uid, options };
  } catch {
    return null;
  }
}
