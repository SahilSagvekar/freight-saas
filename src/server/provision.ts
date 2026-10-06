import { adminTransaction } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_ROLES, type FieldDef, type ItemKind } from "@/lib/domain";
import { toMinor } from "@/lib/money";
import { hashPassword } from "@/lib/password";
import { setTenantSetting } from "./shared";

export type ProvisionInput = {
  name: string;
  slug?: string;
  baseCurrency?: string;
  locale?: string;
  timeZone?: string;
  owner: { name: string; email: string; password: string; phone?: string };
  /** Seed a starter price list so the operator can take a booking straight away. */
  starterCatalog?: boolean;
};

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "operator";

type StarterItem = { kind: ItemKind; name: string; price: string; units?: number; fields?: FieldDef[] };

const STARTER_ITEMS: StarterItem[] = [
  { kind: "PASSENGER", name: "Adult", price: "25.00" },
  { kind: "PASSENGER", name: "Child (under 12)", price: "12.50" },
  { kind: "PASSENGER", name: "Infant", price: "0.00" },
  { kind: "VEHICLE", name: "Car", price: "60.00", fields: [{ key: "plate", label: "Plate number", type: "text", required: true }] },
  {
    kind: "VEHICLE",
    name: "Pickup or van",
    price: "90.00",
    units: 2,
    fields: [{ key: "plate", label: "Plate number", type: "text", required: true }],
  },
  { kind: "VEHICLE", name: "Motorbike", price: "20.00", fields: [{ key: "plate", label: "Plate number", type: "text" }] },
  {
    kind: "CARGO",
    name: "Box",
    price: "15.00",
    fields: [
      { key: "contents", label: "Contents", type: "text", required: true },
      { key: "fragile", label: "Fragile", type: "boolean" },
    ],
  },
  {
    kind: "CARGO",
    name: "Pallet",
    price: "120.00",
    units: 2,
    fields: [
      { key: "contents", label: "Contents", type: "text", required: true },
      { key: "weightKg", label: "Weight (kg)", type: "number" },
    ],
  },
  {
    kind: "CARGO",
    name: "Container",
    price: "600.00",
    units: 8,
    fields: [
      { key: "containerNo", label: "Container number", type: "text", required: true },
      { key: "size", label: "Size", type: "select", options: ["20 ft", "40 ft"], required: true },
    ],
  },
];

/**
 * Creates a new operator end to end: tenant, default roles, owner account and starter catalogue.
 * Runs on the admin connection because it creates the tenant that every other connection is scoped to.
 */
export async function provisionTenant(input: ProvisionInput) {
  const baseCurrency = (input.baseCurrency ?? "USD").toUpperCase();
  const passwordHash = await hashPassword(input.owner.password);
  const email = input.owner.email.trim().toLowerCase();
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);

  return adminTransaction(async (tx) => {
    const existingUser = await tx.$queryRaw<{ id: string }[]>`select id from users where lower(email) = ${email}`;
    if (existingUser.length > 0) throw new Error(`A user with the email ${email} already exists`);

    const taken = await tx.tenant.findUnique({ where: { slug }, select: { id: true } });
    const finalSlug = taken ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

    const tenant = await tx.tenant.create({
      data: {
        name: input.name.trim(),
        slug: finalSlug,
        baseCurrency,
        locale: input.locale ?? "en",
        timeZone: input.timeZone ?? "UTC",
      },
    });

    await tx.role.createMany({
      data: DEFAULT_ROLES.map((r) => ({ tenantId: tenant.id, name: r.name, permissions: [...r.permissions], isSystem: r.name === "Owner" })),
    });
    const ownerRole = await tx.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Owner" } });

    const owner = await tx.user.create({
      data: { email, name: input.owner.name.trim(), phone: input.owner.phone, passwordHash },
      select: { id: true },
    });

    await tx.membership.create({ data: { tenantId: tenant.id, userId: owner.id, roleId: ownerRole.id } });

    // The admin connection owns the tables, so it is not subject to row-level security here.
    await setTenantSetting(tx, tenant.id, "oversellPercent", 5);
    await setTenantSetting(tx, tenant.id, "bookingPrefix", "BK-");
    await setTenantSetting(tx, tenant.id, "invoicePrefix", "INV-");

    if (input.starterCatalog !== false) {
      let order = 0;
      for (const item of STARTER_ITEMS) {
        const row = await tx.itemType.create({
          data: {
            tenantId: tenant.id,
            kind: item.kind,
            name: item.name,
            capacityUnits: item.units ?? 1,
            fieldSchema: (item.fields ?? []) as unknown as Prisma.InputJsonArray,
            sortOrder: order++,
          },
          select: { id: true },
        });
        await tx.priceRule.create({
          data: { tenantId: tenant.id, itemTypeId: row.id, unitPrice: toMinor(item.price, baseCurrency) ?? 0 },
        });
      }
    }

    return { tenantId: tenant.id, slug: finalSlug, ownerUserId: owner.id };
  });
}
