import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/db";
import { verifyConnectState } from "@/lib/tokens";
import { can, getAuth } from "@/server/auth";
import { appBaseUrl } from "@/server/base-url";
import { exchangeConnectCode } from "@/server/stripe";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = await appBaseUrl();
  const back = (flag: string) => NextResponse.redirect(`${base}/app/settings?${flag}`);
  const auth = await getAuth();
  const sp = request.nextUrl.searchParams;
  const state = await verifyConnectState(sp.get("state"));
  // The person finishing must be the same signed-in owner, in the same operator, who started it.
  if (!auth || !state || state.tid !== auth.tenantId || state.uid !== auth.userId || !can(auth, "settings.manage")) return back("connect=invalid");
  const code = sp.get("code");
  if (sp.get("error") || !code) return back("connect=cancelled");
  try {
    const account = await exchangeConnectCode(code);
    await adminDb().tenant.update({ where: { id: auth.tenantId }, data: { stripeAccountId: account } });
  } catch (e) {
    console.error("connect failed", e);
    return back("connect=failed");
  }
  return back("connect=ok");
}
