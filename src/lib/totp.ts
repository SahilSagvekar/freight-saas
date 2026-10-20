import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, the 6-digit codes in Google Authenticator, 1Password, Authy and so on).
 * Built on Node's own crypto, so no extra package is needed. SHA-1, 30-second steps and 6 digits are what
 * authenticator apps expect by default.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** A secret shorter than this (80 bits) is too easy to guess. */
const MIN_SECRET_BYTES = 10;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Spaces, dashes and `=` padding are ignored, since apps and people format secrets in groups. Null when it isn't base32. */
export function base32Decode(input: string): Buffer | null {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean) return null;
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

/** A fresh random secret to scan or type into an authenticator app (160 bits, the usual size). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** Why this secret can't be used, or null when it is fine. */
export function totpSecretProblem(secret: string | null | undefined): string | null {
  if (!secret) return "no secret is set";
  const key = base32Decode(secret);
  if (!key) return "the secret is not valid base32 (use letters A-Z and digits 2-7)";
  if (key.length < MIN_SECRET_BYTES) return "the secret is too short (use at least 16 characters)";
  return null;
}

function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(message).digest();
  const offset = hash[hash.length - 1]! & 0x0f;
  const binary = ((hash[offset]! & 0x7f) << 24) | (hash[offset + 1]! << 16) | (hash[offset + 2]! << 8) | hash[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The code an authenticator app shows right now for this secret. Mostly useful in tests and setup scripts. */
export function totpAt(secret: string, nowMs = Date.now(), digits = TOTP_DIGITS): string {
  const key = base32Decode(secret);
  if (!key) throw new Error("Invalid TOTP secret");
  return hotp(key, Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS), digits);
}

/**
 * True when `code` is the current code, or one step either side (phone clocks drift). Compares in constant time and
 * always checks every step, so how quickly it answers says nothing about how close a guess was.
 */
export function verifyTotp(secret: string, code: string, nowMs = Date.now(), window = 1): boolean {
  const key = base32Decode(secret);
  if (!key || key.length < MIN_SECRET_BYTES) return false;
  const given = code.replace(/\s/g, "");
  if (!/^\d+$/.test(given) || given.length !== TOTP_DIGITS) return false;
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
  const givenBytes = Buffer.from(given);
  let matched = false;
  for (let offset = -window; offset <= window; offset++) {
    const expected = Buffer.from(hotp(key, counter + offset));
    if (timingSafeEqual(expected, givenBytes)) matched = true;
  }
  return matched;
}

/** The `otpauth://` address authenticator apps understand (QR codes and "add by link" use this). */
export function totpUri(secret: string, account: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
