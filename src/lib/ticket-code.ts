import { createHmac, timingSafeEqual } from "node:crypto";
import { secretKey } from "./session";

/**
 * What a ticket's QR code says: "HL1.<booking id>.<signature>". The signature is an HMAC of the booking id, so a code
 * can't be made up or edited, and checking one needs no lookup. Finding the booking still goes through the database
 * under the scanner's own operator, so another operator's ticket simply isn't found.
 */
const PREFIX = "HL1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sign = (bookingId: string) => createHmac("sha256", secretKey()).update(`ticket:${bookingId.toLowerCase()}`).digest("base64url").slice(0, 22);

export const ticketCode = (bookingId: string) => `${PREFIX}.${bookingId.toLowerCase()}.${sign(bookingId)}`;

/** The booking id inside a genuine code, or null. Tolerates surrounding spaces and a full ticket URL. */
export function readTicketCode(input: string): string | null {
  const raw = input.trim();
  const code = raw.includes("/t/") ? decodeURIComponent(raw.split("/t/")[1]!.split(/[?#]/)[0]!) : raw;
  const [prefix, id, sig] = code.split(".");
  if (prefix !== PREFIX || !id || !sig || !UUID.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id.toLowerCase() : null;
}
