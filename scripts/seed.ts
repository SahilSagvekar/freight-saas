/** Creates (or refreshes) a demo operator with ports, a vessel, a week of voyages and some bookings. */
import { adminDb, closeDb, withTenant } from "@/db";
import { createBooking } from "@/server/bookings";
import { provisionTenant } from "@/server/provision";
import { createVoyage } from "@/server/voyages";

const EMAIL = "demo@harborline.test";
const PASSWORD = "demo-password-1";

async function main() {
  const existing = await adminDb().tenant.findUnique({ where: { slug: "blue-lagoon-ferries" } });
  if (existing) {
    console.log("Demo operator already exists.");
  } else {
    const t = await provisionTenant({
      name: "Blue Lagoon Ferries",
      slug: "blue-lagoon-ferries",
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
  console.log(`Sign in with ${EMAIL} / ${PASSWORD}`);
}

main().then(closeDb, (e) => { console.error(e); return closeDb().then(() => process.exit(1)); });
