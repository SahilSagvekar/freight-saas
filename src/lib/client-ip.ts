/**
 * Works out the caller's IP address for throttling, without trusting anything the caller can forge.
 *
 * `x-forwarded-for` is a list: every proxy appends the address it saw. The LEFT-most entry is whatever the
 * client chose to send, so anyone can rotate it to get a fresh throttle bucket on every request. The RIGHT-most
 * entry was written by the proxy closest to us, which is the only one we can trust.
 *
 * Settings (all optional):
 *  - CLIENT_IP_HEADER: a header your host sets and overwrites itself, e.g. `cf-connecting-ip` behind Cloudflare
 *    or `x-real-ip`. When set, only that header is used.
 *  - TRUSTED_PROXY_HOPS: how many proxies sit in front of the app and append to `x-forwarded-for` (default 1).
 *    The address that many entries from the right is used.
 *
 * When nothing usable is present (direct connection, local development) every caller shares the bucket "unknown".
 */
export const UNKNOWN_IP = "unknown";

type Getter = (name: string) => string | null | undefined;

/** Keeps throttle keys short and free of odd characters, and rejects anything that is not shaped like an address. */
function cleanIp(value: string | null | undefined): string | null {
  const v = value?.trim().replace(/^\[|\]$/g, "");
  if (!v || v.length > 45) return null;
  return /^[0-9a-fA-F:.]+$/.test(v) ? v.toLowerCase() : null;
}

export function clientIpFrom(get: Getter, env: Record<string, string | undefined> = process.env): string {
  const headerName = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (headerName) return cleanIp(get(headerName)?.split(",")[0]) ?? UNKNOWN_IP;

  const parts = (get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return cleanIp(get("x-real-ip")) ?? UNKNOWN_IP;

  const parsedHops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10);
  const hops = Number.isInteger(parsedHops) && parsedHops >= 1 ? parsedHops : 1;
  // More hops configured than entries present: fall back to the left-most one rather than nothing.
  return cleanIp(parts[Math.max(0, parts.length - hops)]) ?? UNKNOWN_IP;
}
