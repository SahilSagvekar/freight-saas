import { openDB, type DBSchema } from "idb";
import type { CreateBookingInput } from "./schemas";

/**
 * On-device storage for the ticket desk: a queue of sales waiting to upload, a log of what happened to
 * past ones, and a copy of the price list and sailings. Everything is scoped by operator id so two
 * accounts sharing a browser never see each other's data.
 */
export type QueuedOp = { clientOpId: string; tenantId: string; createdAt: number; payload: CreateBookingInput; summary: { name: string; total: number; currency: string; voyage: string } };
export type OpOutcome = { clientOpId: string; tenantId: string; at: number; status: "APPLIED" | "NEEDS_REVIEW" | "REJECTED"; bookingNo?: string; reason?: string; summary: QueuedOp["summary"] };

interface Schema extends DBSchema {
  queue: { key: string; value: QueuedOp; indexes: { tenant: string } };
  outcomes: { key: string; value: OpOutcome; indexes: { tenant: string } };
  meta: { key: string; value: unknown };
}

const db = () =>
  openDB<Schema>("harborline-desk", 1, {
    upgrade(d) {
      d.createObjectStore("queue", { keyPath: "clientOpId" }).createIndex("tenant", "tenantId");
      d.createObjectStore("outcomes", { keyPath: "clientOpId" }).createIndex("tenant", "tenantId");
      d.createObjectStore("meta");
    },
  });

export const newOpId = () => `op-${crypto.randomUUID()}`;

export async function enqueue(op: QueuedOp) {
  await (await db()).put("queue", op);
}
export async function pending(tenantId: string) {
  return (await (await db()).getAllFromIndex("queue", "tenant", tenantId)).sort((a, b) => a.createdAt - b.createdAt);
}
export async function recentOutcomes(tenantId: string, limit = 10) {
  return (await (await db()).getAllFromIndex("outcomes", "tenant", tenantId)).sort((a, b) => b.at - a.at).slice(0, limit);
}
export async function settle(op: QueuedOp, result: { status: OpOutcome["status"]; bookingNo?: string; reason?: string }) {
  const d = await db();
  const tx = d.transaction(["queue", "outcomes"], "readwrite");
  await tx.objectStore("outcomes").put({ clientOpId: op.clientOpId, tenantId: op.tenantId, at: Date.now(), summary: op.summary, ...result });
  await tx.objectStore("queue").delete(op.clientOpId);
  await tx.done;
}
export async function saveCache<T>(key: string, value: T) {
  await (await db()).put("meta", value, key);
}
export async function loadCache<T>(key: string) {
  return (await (await db()).get("meta", key)) as T | undefined;
}
export async function deviceId() {
  const existing = await loadCache<string>("deviceId");
  if (existing) return existing;
  const id = `dev-${crypto.randomUUID()}`;
  await saveCache("deviceId", id);
  return id;
}
