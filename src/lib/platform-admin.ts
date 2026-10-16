/** Who may open /admin. A comma-separated list of emails in PLATFORM_ADMIN_EMAILS; empty means nobody. */
export function platformAdminEmails(env: string | undefined = process.env.PLATFORM_ADMIN_EMAILS): string[] {
  return (env ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const isPlatformAdmin = (email: string | null | undefined, env?: string) => !!email && platformAdminEmails(env).includes(email.trim().toLowerCase());
