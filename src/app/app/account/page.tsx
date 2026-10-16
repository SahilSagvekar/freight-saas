import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PORTAL_LABEL, portalFor } from "@/lib/portals";
import { requireAuth } from "@/server/auth";
import { AccountForms } from "./account-forms";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const auth = await requireAuth();
  const portal = portalFor(auth.permissions);
  return (
    <>
      <PageHeader title="Your account" description={`${auth.name} · ${auth.email}`} />
      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader title="Where you work" />
          <CardBody className="text-sm">
            <p><span className="text-muted">Operator:</span> {auth.tenant.name}</p>
            <p><span className="text-muted">Role:</span> {auth.roleName}{portal ? ` · ${PORTAL_LABEL[portal]}` : ""}</p>
          </CardBody>
        </Card>
        <AccountForms />
      </div>
    </>
  );
}
