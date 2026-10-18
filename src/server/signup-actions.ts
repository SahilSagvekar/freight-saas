"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { welcomeEmail } from "@/lib/email-templates";
import { planById, TRIAL_DAYS } from "@/lib/plans";
import { regionByCode } from "@/lib/regions";
import { SETUP_LINK_TTL_HOURS } from "@/lib/tokens";
import { appBaseUrl } from "./base-url";
import { mailConfigured, sendMail } from "./mail";
import { provisionTenant } from "./provision";
import { issueSetupLink } from "./setup-links";
import { throttle } from "./throttle";

/** `emailFailed` means the workspace exists but the provider did not accept the message, so nobody has a link yet. */
export type SignupState = { error?: string; done?: { email: string; emailed: boolean; link?: string; emailFailed?: boolean } };

const schema = z.object({
  operator: z.string().trim().min(2, "Enter your company name").max(80),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  region: z.string().refine((c) => !!regionByCode(c), "Choose where you operate"),
  plan: z.string().refine((p) => !!planById(p), "Choose a plan"),
  terms: z.literal("on", { error: "Please accept the terms to continue" }),
});

/** Public sign-up: creates the operator on a free trial and emails the owner a link to choose a password. */
export async function signupAction(_prev: SignupState, f: FormData): Promise<SignupState> {
  // A hidden field real people never fill in. Bots that do get a convincing success and nothing is created.
  if (String(f.get("website") ?? "")) return { done: { email: String(f.get("email") ?? ""), emailed: true } };

  const mail = mailConfigured();
  // Without email we can't confirm the address belongs to the person, so live sign-ups stay closed until it is set up.
  if (process.env.NODE_ENV === "production" && !mail && process.env.ALLOW_UNVERIFIED_SIGNUP !== "1") return { error: "Sign-ups aren't open yet. Please contact us and we'll set you up." };

  const parsed = schema.safeParse({ operator: f.get("operator"), name: f.get("name"), email: f.get("email"), region: f.get("region"), plan: f.get("plan"), terms: f.get("terms") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await throttle(`signup:${ip}`, 5, 60 * 60 * 1000)).allowed || !(await throttle(`signup-email:${d.email}`, 3, 24 * 60 * 60 * 1000)).allowed) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }

  const region = regionByCode(d.region)!;
  let created;
  try {
    created = await provisionTenant({
      name: d.operator,
      baseCurrency: region.currency,
      locale: region.locale,
      timeZone: region.timeZone,
      owner: { name: d.name, email: d.email },
      billing: { plan: d.plan as "starter" | "operator", status: "trialing", trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) },
    });
  } catch (e) {
    if (e instanceof Error && /already exists/.test(e.message)) return { error: "That email already has an account. Try signing in instead." };
    console.error("signup failed", e);
    return { error: "Something went wrong creating your account. Please try again." };
  }

  const link = await issueSetupLink(created.ownerUserId, await appBaseUrl(), SETUP_LINK_TTL_HOURS);
  const emailed = await sendMail(d.email, welcomeEmail({ name: d.name, operator: d.operator, url: link }));
  // Only show the link on screen when there is no email at all (local development). When email IS set up but the
  // provider refused the message, the link stays hidden, because showing it would let anyone claim a workspace
  // under an address they do not own. Say so plainly instead of pretending an email is on its way.
  if (mail && !emailed) {
    console.error(`signup: workspace "${created.slug}" was created but the welcome email was not accepted by the mail provider`);
    return { done: { email: d.email, emailed: false, emailFailed: true } };
  }
  return { done: { email: d.email, emailed, link: emailed || mail ? undefined : link } };
}
