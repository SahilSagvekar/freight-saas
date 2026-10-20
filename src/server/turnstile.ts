/**
 * Cloudflare Turnstile (a free CAPTCHA) for the public forms that anyone on the internet can submit.
 *
 * Needs TURNSTILE_SITE_KEY (public, shown in the page) and TURNSTILE_SECRET_KEY (server only). With neither set the
 * check is skipped, so local development and the demo work with no keys. Where a form must never run unprotected
 * in production (sign-up), pass `required: true`: it then stays closed until the keys are set.
 */
export const TURNSTILE_FIELD = "cf-turnstile-response";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileConfigured = () => Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

/** The public key to hand to the browser widget, or undefined when the check is off. */
export const turnstileSiteKey = () => (turnstileConfigured() ? process.env.TURNSTILE_SITE_KEY : undefined);

export type CaptchaResult = { ok: true } | { ok: false; error: string };

let warned = false;

export async function checkCaptcha(form: FormData, ip: string, options: { required?: boolean } = {}): Promise<CaptchaResult> {
  if (!turnstileConfigured()) {
    if (options.required && process.env.NODE_ENV === "production") {
      return { ok: false, error: "Sign-ups aren't open yet. Please contact us and we'll set you up." };
    }
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn("turnstile: TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are not set, so public forms have no CAPTCHA");
    }
    return { ok: true };
  }

  const token = String(form.get(TURNSTILE_FIELD) ?? "");
  if (!token || token.length > 2048) return { ok: false, error: "Please complete the security check and try again." };

  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (res.ok && data?.success === true) return { ok: true };
    return { ok: false, error: "The security check didn't pass. Please try again." };
  } catch (e) {
    // If Cloudflare can't be reached we stay closed: failing open would let bots through exactly when it is down.
    console.error("turnstile: verification request failed", e);
    return { ok: false, error: "We couldn't run the security check. Please try again in a moment." };
  }
}
