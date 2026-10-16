"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/db";
import { VOYAGE_STATUSES, type VoyageStatus } from "@/lib/domain";
import { canMoveVoyage } from "@/lib/voyage-flow";
import { requireWrite } from "./auth";
import type { ActionResult } from "./booking-actions";
import { BookingError } from "./bookings";
import { setVoyageStatus } from "./voyages";

export async function voyageStatusAction(voyageId: string, to: string): Promise<ActionResult> {
  const auth = await requireWrite("voyage.manage");
  if (!(VOYAGE_STATUSES as readonly string[]).includes(to)) return { ok: false, error: "Unknown status." };
  try {
    await withTenant(auth.tenantId, async (tx) => {
      const voyage = await tx.voyage.findUnique({ where: { id: voyageId }, select: { status: true } });
      if (!voyage) throw new BookingError("NOT_FOUND", "Voyage not found");
      if (!canMoveVoyage(voyage.status as VoyageStatus, to as VoyageStatus)) {
        throw new BookingError("INVALID", `A ${voyage.status.toLowerCase()} voyage can't be set to ${to.toLowerCase()}.`);
      }
      await setVoyageStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, voyageId, to as VoyageStatus);
    });
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
