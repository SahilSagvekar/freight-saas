/**
 * Creates a DEMO operator (fake ports, boats, voyages and bookings) for local development and the hosted demo.
 * It refuses to run on a database that holds any real operator, and on a non-local database unless
 * ALLOW_DEMO_SEED is set, so demo credentials can never end up in live data.
 */
import { adminDb, closeDb, LOCAL_ADMIN_URL, withTenant } from "@/db";
import { DEMO_FREIGHT_SLUG, DEMO_SEED_FLAG, DEMO_TENANT_SLUG, demoSeedBlockedReason } from "@/lib/live-guard";
import { createBooking } from "@/server/bookings";
import { createInquiry } from "@/server/inquiries";
import { createShipment, setShipmentStatus } from "@/server/shipments";
import type { ShipmentInput } from "@/lib/schemas";
import { provisionTenant } from "@/server/provision";
import { createVoyage } from "@/server/voyages";

const EMAIL = process.env.DEMO_EMAIL ?? "demo@harborline.test";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-password-1";
const FREIGHT_EMAIL = process.env.DEMO_FREIGHT_EMAIL ?? "freight@harborline.test";

type Job = { mode: "AIR" | "OCEAN" | "GROUND"; origin: string; destination: string; goods: string; shipper: string; consignee: string; kg: number; carrier: string; vesselOrFlight?: string; voyageNo?: string; masterNo?: string; houseNo?: string; containerNo?: string; sealNo?: string; status?: "BOOKED" | "IN_TRANSIT" };
const JOBS: Job[] = [
  { mode: "AIR", origin: "Mumbai (BOM)", destination: "Dubai (DXB)", goods: "Electronic components", shipper: "Acme Electronics Pvt Ltd", consignee: "Gulf Tech Trading LLC", kg: 480, carrier: "Emirates SkyCargo", vesselOrFlight: "EK 501", masterNo: "176-48219304", houseNo: "HAWB-2041", status: "IN_TRANSIT" },
  { mode: "AIR", origin: "Delhi (DEL)", destination: "Frankfurt (FRA)", goods: "Leather handbags", shipper: "Kapoor Exports", consignee: "Mode GmbH", kg: 265, carrier: "Lufthansa Cargo", vesselOrFlight: "LH 761", masterNo: "020-55120987", houseNo: "HAWB-2042", status: "BOOKED" },
  { mode: "OCEAN", origin: "Nhava Sheva", destination: "Jebel Ali", goods: "Ceramic floor tiles", shipper: "Acme Tiles Pvt Ltd", consignee: "Al Noor Building Materials LLC", kg: 9600, carrier: "MSC", vesselOrFlight: "MSC Aurora", voyageNo: "FA441R", masterNo: "MEDUZ1234567", houseNo: "HBL-1180", containerNo: "MSKU4821931", sealNo: "004417", status: "IN_TRANSIT" },
  { mode: "OCEAN", origin: "Chennai", destination: "Rotterdam", goods: "Auto parts", shipper: "Sundaram Components", consignee: "Bolt BV", kg: 12400, carrier: "Maersk", vesselOrFlight: "Maersk Elba", voyageNo: "204W", houseNo: "HBL-1181", containerNo: "MRKU7731025", sealNo: "552019", status: "BOOKED" },
  { mode: "GROUND", origin: "Bhiwandi", destination: "Bengaluru", goods: "Packaged foods", shipper: "Fresh Foods India", consignee: "Southern Retail Pvt Ltd", kg: 7200, carrier: "Sharma Roadlines", vesselOrFlight: "MH 04 AB 1234", voyageNo: "MH 04 CD 5678", houseNo: "LR-77310", sealNo: "004418", status: "IN_TRANSIT" },
  { mode: "GROUND", origin: "Mumbai", destination: "Ahmedabad", goods: "Pharmaceutical cartons", shipper: "Medico Labs", consignee: "Shree Distributors", kg: 1850, carrier: "Western Haulage", vesselOrFlight: "MH 12 EF 9012", houseNo: "LR-77311", status: "BOOKED" },
];

const toInput = (j: Job): ShipmentInput => ({
  mode: j.mode, customerRef: "", shipper: { name: j.shipper, address: `${j.origin}`, phone: "", email: "", taxId: "" }, consignee: { name: j.consignee, address: `${j.destination}`, phone: "", email: "", taxId: "" }, notifyParty: null,
  origin: j.origin, destination: j.destination, incoterm: "", carrier: j.carrier, vesselOrFlight: j.vesselOrFlight ?? "", voyageNo: j.voyageNo ?? "", masterNo: j.masterNo ?? "", houseNo: j.houseNo ?? "", containerNo: j.containerNo ?? "", sealNo: j.sealNo ?? "",
  etd: "", eta: "", goods: j.goods, marks: "", currency: "USD", notes: "",
  packages: [{ quantity: 12, packageType: j.mode === "AIR" ? "Carton" : "Pallet", description: j.goods, grossWeightKg: j.kg, lengthCm: 120, widthCm: 100, heightCm: 100, marks: "", hsCode: "", declaredValue: null }],
});

async function seedFreightDemo(slugs: string[]) {
  if (slugs.includes(DEMO_FREIGHT_SLUG)) {
    console.log("Demo freight forwarder already exists.");
  } else {
    const t = await provisionTenant({ name: "Harbor Gate Freight", slug: DEMO_FREIGHT_SLUG, baseCurrency: "USD", owner: { name: "Ravi Menon", email: FREIGHT_EMAIL, password: PASSWORD }, workspaceKind: "freight" });
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    await withTenant(t.tenantId, async (tx) => {
      for (const j of JOBS) {
        const s = await createShipment(tx, ctx, toInput(j));
        if (j.status === "IN_TRANSIT") {
          await setShipmentStatus(tx, ctx, s.id, "PICKED_UP");
          await setShipmentStatus(tx, ctx, s.id, "IN_TRANSIT");
        }
      }
      const qctx = { ...ctx, actorId: null, source: "FORM" as const };
      await createInquiry(tx, qctx, { name: "Priya Shah", email: "priya@example.test", mode: "AIR", origin: "Mumbai", destination: "London", cargo: "Garments, 20 cartons", weightKg: 300 });
      await createInquiry(tx, qctx, { name: "Imran Qureshi", email: "imran@example.test", mode: "GROUND", origin: "Pune", destination: "Hyderabad", cargo: "Machine parts, 4 pallets", weightKg: 2200 });
      await createInquiry(tx, qctx, { name: "Lena Okafor", email: "lena@example.test", mode: "UNSURE", origin: "Chennai", destination: "Lagos", cargo: "Medical supplies", weightKg: 900 });
    });
    console.log("Seeded demo freight forwarder.");
  }
  console.log(`Freight demo: ${FREIGHT_EMAIL} / ${PASSWORD}`);
}

async function main() {
  const slugs = (await adminDb().tenant.findMany({ select: { slug: true } })).map((t: { slug: string }) => t.slug);
  const blocked = demoSeedBlockedReason({
    adminUrl: process.env.ADMIN_DATABASE_URL ?? LOCAL_ADMIN_URL,
    flag: process.env[DEMO_SEED_FLAG],
    existingSlugs: slugs,
  });
  if (blocked) throw new Error(`Refusing to seed: ${blocked}`);

  const existing = slugs.includes(DEMO_TENANT_SLUG);
  if (existing) {
    console.log("Demo operator already exists.");
  } else {
    const t = await provisionTenant({
      name: "Blue Lagoon Ferries",
      slug: DEMO_TENANT_SLUG,
      baseCurrency: "USD",
      owner: { name: "Maya Collins", email: EMAIL, password: PASSWORD },
      starterCatalog: true,
    });
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    await withTenant(t.tenantId, async (tx) => {
      const mk = (code: string, name: string) => tx.location.create({ data: { tenantId: t.tenantId, code, name } });
      const [nas, exu, geo] = [await mk("NAS", "Nassau"), await mk("EXU", "Exuma"), await mk("GEO", "George Town")];
      const a = await tx.vessel.create({ data: { tenantId: t.tenantId, name: "MV Lagoon Star", capacities: { PASSENGER: 120, VEHICLE: 12, CARGO: 24 } } });
      const b = await tx.vessel.create({ data: { tenantId: t.tenantId, name: "MV Coral Runner", capacities: { PASSENGER: 60, VEHICLE: 6, CARGO: 30 } } });
      const types = await tx.itemType.findMany({ where: { tenantId: t.tenantId } });
      const type = (n: string) => types.find((x) => x.name === n)!;
      const day = 24 * 3600 * 1000;
      const voyages = [];
      for (let i = 0; i < 6; i++) {
        const at = new Date(Date.now() + (i + 1) * day);
        at.setHours(i % 2 ? 14 : 8, 0, 0, 0);
        voyages.push(await createVoyage(tx, ctx, { vesselId: i % 2 ? b.id : a.id, originId: i % 3 === 2 ? exu.id : nas.id, destinationId: i % 3 === 2 ? geo.id : exu.id, departureAt: at }));
      }
      const people = ["Daniel Rolle", "Priya Nair", "Sam Whitfield", "Aisha Bell", "Tomas Ferreira", "Lena Okafor"];
      for (const [i, v] of voyages.slice(0, 4).entries()) {
        for (let k = 0; k < 3 + i; k++) {
          await createBooking(tx, { ...ctx, source: "ONLINE" }, {
            voyageId: v.id,
            contactName: people[(i + k) % people.length],
            lines: [
              { itemTypeId: type("Adult").id, quantity: 1 + ((i + k) % 4) },
              ...(k % 2 ? [{ itemTypeId: type("Car").id, quantity: 1, attributes: { plate: `AB ${1000 + i * 10 + k}` } }] : []),
              ...(k % 3 === 0 ? [{ itemTypeId: type("Box").id, quantity: 2, attributes: { contents: "Groceries" } }] : []),
            ],
          });
        }
      }
    });
    console.log("Seeded demo operator.");
  }
  console.log(`Ferry demo: ${EMAIL} / ${PASSWORD}`);
  await seedFreightDemo(slugs);
}

main().then(closeDb, (e) => { console.error(e); return closeDb().then(() => process.exit(1)); });
