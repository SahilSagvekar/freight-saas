import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";

export default function NoAccess() {
  return <Card><EmptyState icon={Lock} title="You don't have access to this page" description="Ask the owner of your account to change your role if you need it." action={<ButtonLink variant="secondary" href="/app">Back to dashboard</ButtonLink>} /></Card>;
}
