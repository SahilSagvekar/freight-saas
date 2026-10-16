import { PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/server/auth";
import { CheckinClient } from "./checkin-client";

export const metadata = { title: "Check-in" };

export default async function CheckinPage() {
  await requirePermission("manifest.update");
  return (
    <>
      <PageHeader title="Check-in" description="Scan a ticket at the gangway, or type the code under the QR." />
      <CheckinClient />
    </>
  );
}
