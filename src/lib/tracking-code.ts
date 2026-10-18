import { createHmac, timingSafeEqual } from "node:crypto";
import { secretKey } from "./session";

/**
 * What a shipment's tracking link and label QR say: "HS1.<shipment id>.<signature>". Like the ticket code, the
 * signature is an HMAC of the id (with its own prefix, so a ticket code can't be passed off as a tracking code),
 * which means codes can't be guessed or edited. Whoever holds the link can see the status, and nothing else.
 */
const PREFIX = "HS1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sign = (id: string) => createHmac("sha256", secretKey()).update(`shipment-track:${id.toLowerCase()}`).digest("base64url").slice(0, 22);

export const trackingCode = (shipmentId: string) => `${PREFIX}.${shipmentId.toLowerCase()}.${sign(shipmentId)}`;

/** The shipment id inside a genuine code, or null. Tolerates spaces and a full /track/ link. */
export function readTrackingCode(input: string): string | null {
  const raw = input.trim();
  const code = raw.includes("/track/") ? decodeURIComponent(raw.split("/track/")[1]!.split(/[?#]/)[0]!) : raw;
  const [prefix, id, sig] = code.split(".");
  if (prefix !== PREFIX || !id || !sig || !UUID.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id.toLowerCase() : null;
}
