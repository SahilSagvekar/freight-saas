import type { Tx } from "@/db";
import { packageTotals, type PackageLine } from "@/lib/shipment";
import { getTenantConfig } from "./shared";
import { getShipment, packageLinesOf, partyOf } from "./shipments";

/** Everything the printable documents need, read once. Null when the shipment isn't there (or isn't this operator's). */
export async function loadShipmentDoc(tx: Tx, companyName: string, id: string) {
  const s = await getShipment(tx, id);
  if (!s) return null;
  const config = await getTenantConfig(tx);
  const lines: PackageLine[] = packageLinesOf(s.packages);
  return {
    s,
    lines,
    totals: packageTotals(lines),
    shipper: partyOf(s.shipper),
    consignee: partyOf(s.consignee),
    notify: s.notifyParty ? partyOf(s.notifyParty) : null,
    company: { name: companyName, ...config.company },
    terms: config.documentTerms,
  };
}

export type ShipmentDoc = NonNullable<Awaited<ReturnType<typeof loadShipmentDoc>>>;
