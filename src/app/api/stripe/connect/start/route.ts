import { NextResponse } from "next/server";
import { signConnectState } from "@/lib/tokens";
import { can, getAuth } from "@/server/auth";
import { appBaseUrl } from "@/server/base-url";
import { connectAuthorizeUrl, connectConfigured } from "@/server/stripe";

export const dynamic = "force-dynamic";

/** Sends the owner to Stripe to connect their own account, so ticket money goes straight to them. */
export async function GET() {
  const auth = await getAuth();
  const base = await appBaseUrl();
  if (!auth) return NextResponse.redirect(`${base}/login`);
  if (!can(auth, "settings.manage") || !connectConfigured()) return NextResponse.redirect(`${base}/app/settings`);
  const state = await signConnectState({ tid: auth.tenantId, uid: auth.userId });
  return NextResponse.redirect(connectAuthorizeUrl(state, `${base}/api/stripe/connect/callback`));
}
