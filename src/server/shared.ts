import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/db";
import { DEFAULT_OVERSELL_PERCENT } from "@/lib/domain";

/** Next per-tenant sequence value. The upsert locks the counter row, so concurrent callers never collide. */
export async function nextNumber(tx: Tx, tenantId: string, key: "booking" | "invoice" | "voyage"): Promise<number> {
  // Raw on purpose: Prisma's upsert is not always a single atomic INSERT ... ON CONFLICT.
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    insert into counters (tenant_id, key, value) values (${tenantId}::uuid, ${key}, 1)
    on conflict (tenant_id, key) do update set value = counters.value + 1
    returning value`;
  return row.value;
}

export async function audit(
  tx: Tx,
  entry: {
    tenantId: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const json = (v: unknown) => (v == null ? Prisma.DbNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: json(entry.before),
      after: json(entry.after),
    },
  });
}

export type TenantConfig = {
  oversellPercent: number;
  bookingPrefix: string;
  invoicePrefix: string;
};

export async function getTenantConfig(tx: Tx): Promise<TenantConfig> {
  const rows = await tx.tenantSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string, fallback: number) => {
    const v = map.get(key);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const str = (key: string, fallback: string) => {
    const v = map.get(key);
    return typeof v === "string" ? v : fallback;
  };
  return {
    oversellPercent: num("oversellPercent", DEFAULT_OVERSELL_PERCENT),
    bookingPrefix: str("bookingPrefix", "BK-"),
    invoicePrefix: str("invoicePrefix", "INV-"),
  };
}

export async function setTenantSetting(tx: Tx, tenantId: string, key: string, value: unknown) {
  const json = value as Prisma.InputJsonValue;
  await tx.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: json },
    update: { value: json },
  });
}

export const formatBookingNo = (config: TenantConfig, n: number) => `${config.bookingPrefix}${String(n).padStart(5, "0")}`;
export const formatInvoiceNo = (config: TenantConfig, n: number) => `${config.invoicePrefix}${String(n).padStart(5, "0")}`;
