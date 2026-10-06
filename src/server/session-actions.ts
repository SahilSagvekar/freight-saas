"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { authenticate } from "@/server/credentials";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

/** Only allow redirects back into the app, never to another site. */
const safeNext = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.startsWith("/app") && !value.startsWith("//") ? value : "/app";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `login:${ip}:${parsed.data.email.toLowerCase()}`;
  const limited = rateLimit(key, 8, 15 * 60 * 1000);
  if (!limited.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s).`, email };
  }

  const session = await authenticate(parsed.data.email, parsed.data.password);
  if (!session) return { error: "That email and password don't match.", email };

  resetRateLimit(key);
  (await cookies()).set(SESSION_COOKIE, await signSession(session), sessionCookieOptions);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
