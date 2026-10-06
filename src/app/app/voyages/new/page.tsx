import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { withTenant } from "@/db";
import { requirePermission } from "@/server/auth";
import { VoyageForm } from "./client";

export const metadata = { title: "Schedule voyage" };

export default async function NewVoyagePage() {
  const auth = await requirePermission("voyage.manage");
  const { boats, ports } = await withTenant(auth.tenantId, async (tx) => ({ boats: await tx.vessel.findMany({ orderBy: { name: "asc" } }), ports: await tx.location.findMany({ orderBy: { name: "asc" } }) }));
  return (
    <>
      <PageHeader title="Schedule a voyage" />
      {boats.length === 0 || ports.length < 2 ? (
        <Alert tone="warning" title="Set up your fleet first">Add at least one vessel and two ports in <Link className="underline" href="/app/settings">Settings</Link>.</Alert>
      ) : (
        <Card className="max-w-2xl"><CardBody><VoyageForm vessels={boats} ports={ports} /></CardBody></Card>
      )}
    </>
  );
}
