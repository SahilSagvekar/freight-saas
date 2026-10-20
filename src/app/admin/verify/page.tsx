import { redirect } from "next/navigation";
import { AuthShell } from "@/app/(auth)/auth-shell";
import { adminTwoFactorProblem, adminTwoFactorRequired, hasAdminTwoFactor } from "@/server/admin-2fa";
import { requirePlatformAdminPassword } from "@/server/admin";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Confirm it's you" };
export const dynamic = "force-dynamic";

export default async function AdminVerifyPage() {
  const auth = await requirePlatformAdminPassword();
  // Nothing to confirm (development without a secret), or already confirmed: go straight to the console.
  if (!adminTwoFactorRequired() || (await hasAdminTwoFactor(auth.userId))) redirect("/admin");
  if (adminTwoFactorProblem()) {
    console.error(`admin console is closed: ${adminTwoFactorProblem()}`);
    redirect("/app");
  }
  return (
    <AuthShell title="Confirm it's you" subtitle="Enter the 6-digit code from your authenticator app to open the platform console.">
      <VerifyForm />
    </AuthShell>
  );
}
