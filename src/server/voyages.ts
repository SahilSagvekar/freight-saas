import { lockRow, type Tx } from "@/db";
import { VOYAGE_STATUSES, type VoyageStatus } from "@/lib/domain";
import { BookingError, type Actor } from "./bookings";
import { audit, nextNumber } from "./shared";

export type CreateVoyageInput = {
  vesselId: string;
  originId: string;
  destinationId: string;
  departureAt: Date;
  arrivalAt?: Date | null;
  notes?: string;
};

export async function createVoyage(tx: Tx, ctx: Actor, input: CreateVoyageInput) {
  if (input.originId === input.destinationId) throw new BookingError("INVALID", "Origin and destination must differ");
  if (input.arrivalAt && input.arrivalAt <= input.departureAt) {
    throw new BookingError("INVALID", "Arrival must be after departure");
  }

  // Rows are tenant-scoped, so these lookups also prove the ids belong to this operator.
  const vessel = await tx.vessel.findUnique({ where: { id: input.vesselId }, select: { id: true } });
  const origin = await tx.location.findUnique({ where: { id: input.originId }, select: { id: true } });
  const destination = await tx.location.findUnique({ where: { id: input.destinationId }, select: { id: true } });
  if (!vessel || !origin || !destination) throw new BookingError("NOT_FOUND", "Choose a valid vessel and route");

  const voyageNo = await nextNumber(tx, ctx.tenantId, "voyage");
  const voyage = await tx.voyage.create({
    data: {
      tenantId: ctx.tenantId,
      voyageNo,
      vesselId: input.vesselId,
      originId: input.originId,
      destinationId: input.destinationId,
      departureAt: input.departureAt,
      arrivalAt: input.arrivalAt ?? null,
      notes: input.notes || null,
    },
  });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "voyage.created", entity: "voyage", entityId: voyage.id, after: { voyageNo } });
  return voyage;
}

export async function setVoyageStatus(tx: Tx, ctx: Actor, voyageId: string, status: VoyageStatus) {
  if (!VOYAGE_STATUSES.includes(status)) throw new BookingError("INVALID", "Unknown status");
  await lockRow(tx, "voyages", voyageId);
  const voyage = await tx.voyage.findUnique({ where: { id: voyageId } });
  if (!voyage) throw new BookingError("NOT_FOUND", "Voyage not found");
  await tx.voyage.update({ where: { id: voyageId }, data: { status } });
  await audit(tx, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: "voyage.status",
    entity: "voyage",
    entityId: voyageId,
    before: { status: voyage.status },
    after: { status },
  });
}
