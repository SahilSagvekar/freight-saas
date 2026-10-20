import { headers } from "next/headers";
import { clientIpFrom } from "@/lib/client-ip";

/** The caller's IP for server actions. See src/lib/client-ip.ts for what is trusted and why. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return clientIpFrom((name) => h.get(name));
}
