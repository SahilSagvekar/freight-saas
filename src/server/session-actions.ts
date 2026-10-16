"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { signChoiceToken, verifyChoiceToken } from "@/lib/tokens";
import { authenticateUser } from "@/server/credentials";
import { clearThrottle, throttle } from "@/server/throttle";

export type LoginState = {
  error?: string;
  email?: string;
  /** Set when the password was right but the person works for several operators and must pick one. */
  choose?: { token: string; next: string; options: { mid: string; tenantName: string; roleName: string }[] };
};

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

/** Only allow redirects back into the app, never to another site. */
const safeNext = (value: FormDataEntryValue | null) =>
  typeof value === "string" && (value.startsWith("/app") || value.startsWith("/admin")) && !value.startsWith("//") ? value : "/app";

async function startSession(session: { uid: string; tid: string; mid: string }) {
  (await cookies()).set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `login:${ip}:${parsed.data.email.toLowerCase()}`;
  const limited = await throttle(key, 8, 15 * 60 * 1000);
  if (!limited.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s).`, email };
  }

  const result = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!result) return { error: "That email and password don't match.", email };

  await clearThrottle(key);
  const next = safeNext(formData.get("next"));

  const only = result.memberships.length === 1 ? result.memberships[0] : null;
  if (only) {
    await startSession({ uid: result.uid, tid: only.tid, mid: only.mid });
    redirect(next);
  }

  // Several operators: the password was right, so let them choose without typing it again.
  const token = await signChoiceToken({ uid: result.uid, options: result.memberships.map(({ mid, tid }) => ({ mid, tid })) });
  return {
    email,
    choose: { token, next, options: result.memberships.map(({ mid, tenantName, roleName }) => ({ mid, tenantName, roleName })) },
  };
}

export async function chooseOperatorAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const claims = await verifyChoiceToken(String(formData.get("token") ?? ""));
  const mid = String(formData.get("mid") ?? "");
  const picked = claims?.options.find((o) => o.mid === mid);
  if (!claims || !picked) return { error: "That took too long. Please sign in again." };

  await startSession({ uid: claims.uid, tid: picked.tid, mid: picked.mid });
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
