import { PLANS } from "@/lib/plans";
import { turnstileSiteKey } from "@/server/turnstile";
import { AuthShell } from "../auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create your workspace" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  const initial = PLANS.find((p) => p.id === plan)?.id ?? PLANS[0]!.id;
  return (
    <AuthShell title="Create your workspace" subtitle="No card needed. Most teams are set up in an afternoon.">
      <SignupForm initialPlan={initial} captchaSiteKey={turnstileSiteKey()} />
    </AuthShell>
  );
}
