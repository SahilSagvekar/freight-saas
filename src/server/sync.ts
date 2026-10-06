import { createHash } from "node:crypto";
import { withTenant } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/lib/domain";
import type { SyncRequest } from "@/lib/schemas";
import { BookingError, createBooking } from "./bookings";

export type SyncOpResult = {
  clientOpId: string;
  /** APPLIED: booking confirmed. NEEDS_REVIEW: saved, staff must resolve. REJECTED: will never succeed. */
  status: "APPLIED" | "NEEDS_REVIEW" | "REJECTED";
  bookingId?: string;
  bookingNo?: string;
  bookingStatus?: BookingStatus;
  reason?: string;
  /** True when this result was replayed from an earlier delivery of the same operation. */
  duplicate?: boolean;
};

const hashPayload = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

/**
 * Applies operations queued on a device. Safe to call repeatedly with the same operations:
 * each clientOpId is applied once, and every later delivery gets the stored result back.
 * Operations are independent, so one bad sale never blocks the rest of the queue.
 */
export async function applySyncOps(
  ctx: { tenantId: string; actorId: string },
  request: SyncRequest,
): Promise<SyncOpResult[]> {
  const results: SyncOpResult[] = [];
  for (const op of request.ops) {
    results.push(await applyOne(ctx, request.deviceId, op));
  }
  return results;
}

async function applyOne(
  ctx: { tenantId: string; actorId: string },
  deviceId: string,
  op: SyncRequest["ops"][number],
): Promise<SyncOpResult> {
  const payloadHash = hashPayload(op.payload);

  return withTenant(ctx.tenantId, async (tx) => {
    // The primary key (tenant, clientOpId) makes this insert the gate: a concurrent duplicate waits on it,
    // then sees the row the first request committed.
    const claimed = await tx.syncOperation.createMany({
      data: [{ tenantId: ctx.tenantId, clientOpId: op.clientOpId, deviceId, payloadHash, status: "APPLIED" }],
      skipDuplicates: true,
    });

    if (claimed.count === 0) {
      const existing = await tx.syncOperation.findFirstOrThrow({ where: { clientOpId: op.clientOpId } });
      if (existing.payloadHash !== payloadHash) {
        return { clientOpId: op.clientOpId, status: "REJECTED", reason: "This operation id was already used for a different sale" };
      }
      return { ...(existing.result as Omit<SyncOpResult, "duplicate">), clientOpId: op.clientOpId, status: existing.status as SyncOpResult["status"], duplicate: true };
    }

    let result: SyncOpResult;
    try {
      // A savepoint, so a rejected sale rolls back its own writes but the ledger row survives.
      // Prisma has no nested transactions, so the savepoint is managed by hand on the same connection.
      await tx.$executeRaw`savepoint sync_op`;
      let booking;
      try {
        booking = await createBooking(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, source: "OFFLINE_SYNC", clientOpId: op.clientOpId }, op.payload);
      } catch (error) {
        await tx.$executeRaw`rollback to savepoint sync_op`;
        throw error;
      }
      await tx.$executeRaw`release savepoint sync_op`;
      result = {
        clientOpId: op.clientOpId,
        status: booking.status === "CONFIRMED" ? "APPLIED" : "NEEDS_REVIEW",
        bookingId: booking.bookingId,
        bookingNo: booking.bookingNo,
        bookingStatus: booking.status,
        reason: booking.reviewReason ?? undefined,
      };
    } catch (error) {
      if (!(error instanceof BookingError)) throw error; // infrastructure failure: roll back everything, device retries
      result = { clientOpId: op.clientOpId, status: "REJECTED", reason: error.message };
    }

    const { clientOpId: _omit, duplicate: _dup, ...stored } = result;
    void _omit;
    void _dup;
    await tx.syncOperation.updateMany({
      where: { clientOpId: op.clientOpId },
      data: { status: result.status, result: stored as Prisma.InputJsonObject },
    });
    return result;
  });
}
