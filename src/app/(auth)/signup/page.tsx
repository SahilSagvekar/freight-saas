import { PLANS } from "@/lib/plans";
import { AuthShell } from "../auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  const initial = PLANS.find((p) => p.id === plan)?.id ?? PLANS[0]!.id;
  return (
    <AuthShell title="Start your free trial" subtitle="No card needed. You'll be selling tickets in an afternoon.">
      <SignupForm initialPlan={initial} />
    </AuthShell>
  );
}
