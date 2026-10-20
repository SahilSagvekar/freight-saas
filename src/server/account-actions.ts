"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb } from "@/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { resetEmail } from "@/lib/email-templates";
import { SETUP_LINK_TTL_HOURS } from "@/lib/tokens";
import { requireAuth } from "./auth";
import { appBaseUrl } from "./base-url";
import { clientIp } from "./client-ip";
import { sendMail, mailConfigured } from "./mail";
import { issueSetupLink } from "./setup-links";
import { throttle } from "./throttle";

export type AccountState = { error?: string; ok?: string };

/** Changes the password, ends every other session, and keeps this one signed in. */
export async function changePasswordAction(_prev: AccountState, f: FormData): Promise<AccountState> {
  const auth = await requireAuth();
  const current = String(f.get("current") ?? "");
  const next = String(f.get("next") ?? "");
  if (next !== String(f.get("confirm") ?? "")) return { error: "The two new passwords don't match." };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };

  if (!(await throttle(`change-password:${auth.userId}`, 6, 15 * 60 * 1000)).allowed) return { error: "Too many attempts. Try again in a few minutes." };
  const user = await adminDb().user.findUnique({ where: { id: auth.userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };

  await adminDb().user.update({ where: { id: auth.userId }, data: { passwordHash: await hashPassword(next), sessionsValidFrom: new Date() } });
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: auth.userId, tid: auth.tenantId, mid: auth.membershipId }), sessionCookieOptions);
  return { ok: "Password changed. You've been signed out everywhere else." };
}

export async function signOutEverywhereAction() {
  const auth = await requireAuth();
  await adminDb().user.update({ where: { id: auth.userId }, data: { sessionsValidFrom: new Date() } });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export type ForgotState = { done?: boolean; error?: string; emailConfigured?: boolean };

/**
 * Always answers the same way, so it can't be used to find out who has an account.
 * With email off there is nothing to send, so the answer tells them to ask their administrator.
 */
export async function forgotPasswordAction(_prev: ForgotState, f: FormData): Promise<ForgotState> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter the email you sign in with." };
  const ip = await clientIp();
  if (!(await throttle(`forgot:${ip}`, 5, 15 * 60 * 1000)).allowed || !(await throttle(`forgot-email:${email}`, 3, 60 * 60 * 1000)).allowed) {
    return { error: "Too many requests. Try again in a little while." };
  }
  if (mailConfigured()) {
    const rows = await adminDb().$queryRaw<{ id: string; name: string }[]>`
      select u.id, u.name from users u
      where lower(u.email) = ${email}
        and exists (select 1 from memberships m join tenants t on t.id = m.tenant_id where m.user_id = u.id and m.status = 'active' and t.status = 'active')`;
    const user = rows[0];
    if (user) {
      const url = await issueSetupLink(user.id, await appBaseUrl(), SETUP_LINK_TTL_HOURS);
      await sendMail(email, resetEmail({ name: user.name, url, hours: SETUP_LINK_TTL_HOURS }));
    }
  }
  return { done: true, emailConfigured: mailConfigured() };
}
