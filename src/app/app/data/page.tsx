import { Download } from "lucide-react";
import { ImportForm } from "@/components/app/import-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/shipment-import";
import { can, requirePermission } from "@/server/auth";

export const metadata = { title: "Import and export" };

export default async function DataPage() {
  const auth = await requirePermission("booking.view");
  const canImport = can(auth, "booking.create");
  return (
    <>
      <PageHeader title="Import and export" description="Move your shipments in and out as spreadsheets." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Export" description="Opens in Excel or Google Sheets." />
          <CardBody className="flex flex-wrap gap-2">
            <ButtonLink href="/api/export/shipments" variant="secondary" prefetch={false}><Download className="size-4" aria-hidden />All shipments</ButtonLink>
            {canImport && <ButtonLink href="/api/export/inquiries" variant="secondary" prefetch={false}><Download className="size-4" aria-hidden />All inquiries</ButtonLink>}
          </CardBody>
        </Card>
        {canImport && (
          <Card>
            <CardHeader title="Import shipments" description={`One row per shipment, up to ${IMPORT_MAX_ROWS} rows. If any row has a problem, nothing is imported and you get the list to fix.`} />
            <CardBody className="space-y-4">
              <ButtonLink href="/api/export/shipment-template" variant="ghost" prefetch={false}><Download className="size-4" aria-hidden />Download the template</ButtonLink>
              <ImportForm />
              <p className="text-xs text-muted">Columns: {IMPORT_COLUMNS.join(", ")}. The first seven are required. Each row becomes one shipment with a single package line. Add more lines afterwards by editing the shipment.</p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
