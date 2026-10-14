import { ButtonLink } from "@/components/ui/button";
import { describeSetupToken } from "@/server/setup-links";
import { AuthShell } from "../auth-shell";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Choose your password" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const who = await describeSetupToken(value);

  if (!who) {
    return (
      <AuthShell title="This link no longer works" subtitle="Setup links work once and expire after 3 days. Ask the person who invited you to send a new one.">
        <ButtonLink href="/login" variant="secondary" size="lg" className="w-full">Go to sign in</ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Welcome, ${who.name.split(" ")[0]}`} subtitle="Choose the password you will use to sign in.">
      <SetPasswordForm token={value} email={who.email} />
    </AuthShell>
  );
}
