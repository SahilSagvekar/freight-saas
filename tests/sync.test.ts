import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, withTenant } from "@/db";
import type { CreateBookingInput } from "@/lib/schemas";
import { approveBooking, rejectBooking, usedCapacity } from "@/server/bookings";
import { applySyncOps } from "@/server/sync";
import { makeOperation } from "./helpers";

afterAll(closeDb);

type Op = Awaited<ReturnType<typeof makeOperation>>;

const sale = (op: Op, qty: number, extra: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
  voyageId: op.voyage.id,
  contactName: "Offline Customer",
  lines: [{ itemTypeId: op.type("Adult").id, quantity: qty }],
  ...extra,
});

const send = (op: Op, ops: { clientOpId: string; payload: CreateBookingInput }[]) =>
  applySyncOps(
    { tenantId: op.tenantId, actorId: op.ownerUserId },
    { deviceId: "device-1", ops: ops.map((o) => ({ ...o, type: "CREATE_BOOKING" as const })) },
  );

const opId = () => `op-${randomUUID()}`;

describe("offline sync", () => {
  it("applies each operation exactly once, however many times it is delivered", async () => {
    const op = await makeOperation();
    const id = opId();
    const payload = sale(op, 2);

    const first = await send(op, [{ clientOpId: id, payload }]);
    const second = await send(op, [{ clientOpId: id, payload }]);
    const third = await send(op, [{ clientOpId: id, payload }]);

    expect(first[0]).toMatchObject({ status: "APPLIED", bookingNo: "BK-00001" });
    expect(first[0].duplicate).toBeUndefined();
    for (const replay of [second[0], third[0]]) {
      expect(replay).toMatchObject({ status: "APPLIED", bookingNo: "BK-00001", bookingId: first[0].bookingId, duplicate: true });
    }

    const all = await withTenant(op.tenantId, (tx) => tx.booking.findMany());
    expect(all).toHaveLength(1);
    expect(await withTenant(op.tenantId, (tx) => tx.invoice.findMany())).toHaveLength(1);
  });

  it("stays exactly-once when the same operation arrives concurrently", async () => {
    const op = await makeOperation();
    const id = opId();
    const payload = sale(op, 1);

    const results = await Promise.all(Array.from({ length: 6 }, () => send(op, [{ clientOpId: id, payload }])));
    const bookingIds = new Set(results.map((r) => r[0].bookingId));
    expect(bookingIds.size).toBe(1);
    expect(results.filter((r) => !r[0].duplicate)).toHaveLength(1);
    expect(await withTenant(op.tenantId, (tx) => tx.booking.findMany())).toHaveLength(1);
  });

  it("rejects an operation id that is reused for a different sale", async () => {
    const op = await makeOperation();
    const id = opId();
    await send(op, [{ clientOpId: id, payload: sale(op, 1) }]);
    const [clash] = await send(op, [{ clientOpId: id, payload: sale(op, 3) }]);
    expect(clash.status).toBe("REJECTED");
    expect(clash.reason).toMatch(/different sale/);
    expect(await withTenant(op.tenantId, (tx) => tx.booking.findMany())).toHaveLength(1);
  });

  it("a bad operation does not block the rest of the queue, and is not retried forever", async () => {
    const op = await makeOperation();
    const bad = { clientOpId: opId(), payload: sale(op, 1, { voyageId: randomUUID() }) };
    const good = { clientOpId: opId(), payload: sale(op, 1) };

    const [r1, r2] = await send(op, [bad, good]);
    expect(r1.status).toBe("REJECTED");
    expect(r2.status).toBe("APPLIED");

    // Delivering the bad one again returns the stored rejection instead of trying again.
    const [again] = await send(op, [bad]);
    expect(again).toMatchObject({ status: "REJECTED", duplicate: true });
  });

  it("allows a small oversell allowance, then flags the rest for review without losing the sale", async () => {
    const op = await makeOperation({ PASSENGER: 20, VEHICLE: 1, CARGO: 1 }); // allowance = ceil(20 x 5%) = 1
    const [filled] = await send(op, [{ clientOpId: opId(), payload: sale(op, 20) }]);
    const [over] = await send(op, [{ clientOpId: opId(), payload: sale(op, 1) }]);
    const [tooMany] = await send(op, [{ clientOpId: opId(), payload: sale(op, 1) }]);

    expect(filled.status).toBe("APPLIED");
    expect(over.status).toBe("APPLIED"); // the 21st seat, inside the allowance
    expect(tooMany.status).toBe("NEEDS_REVIEW"); // the 22nd
    expect(tooMany.reason).toMatch(/passenger space/i);

    await withTenant(op.tenantId, async (tx) => {
      const [flagged] = await tx.booking.findMany({ where: { id: tooMany.bookingId! } });
      expect(flagged.status).toBe("NEEDS_REVIEW");
      // A flagged booking holds no capacity, no invoice and no manifest entry until staff accept it.
      expect((await usedCapacity(tx, op.voyage.id)).PASSENGER).toBe(21);
      expect(await tx.invoice.findMany({ where: { bookingId: flagged.id } })).toHaveLength(0);
    });
  });

  it("flags a sale whose price changed since the agent quoted it", async () => {
    const op = await makeOperation();
    const [result] = await send(op, [{ clientOpId: opId(), payload: sale(op, 2, { quotedTotal: 4000 }) }]); // real: 2 x 25.00
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reason).toMatch(/price changed/i);

    const [matching] = await send(op, [{ clientOpId: opId(), payload: sale(op, 2, { quotedTotal: 5000 }) }]);
    expect(matching.status).toBe("APPLIED");
  });

  it("lets staff approve a flagged booking (invoice and manifest appear) or reject it", async () => {
    const op = await makeOperation();
    const [flagA] = await send(op, [{ clientOpId: opId(), payload: sale(op, 2, { quotedTotal: 1 }) }]);
    const [flagB] = await send(op, [{ clientOpId: opId(), payload: sale(op, 1, { quotedTotal: 1 }) }]);

    await withTenant(op.tenantId, (tx) => approveBooking(tx, op.ctx, flagA.bookingId!));
    await withTenant(op.tenantId, (tx) => rejectBooking(tx, op.ctx, flagB.bookingId!, "Customer did not travel"));

    await withTenant(op.tenantId, async (tx) => {
      const [a] = await tx.booking.findMany({ where: { id: flagA.bookingId! } });
      const [b] = await tx.booking.findMany({ where: { id: flagB.bookingId! } });
      expect(a.status).toBe("CONFIRMED");
      expect(b.status).toBe("CANCELLED");
      expect(await tx.invoice.findMany({ where: { bookingId: a.id } })).toHaveLength(1);
      expect(await tx.manifestEntry.findMany()).toHaveLength(1);
      expect((await usedCapacity(tx, op.voyage.id)).PASSENGER).toBe(2);
    });

    await expect(withTenant(op.tenantId, (tx) => approveBooking(tx, op.ctx, flagA.bookingId!))).rejects.toMatchObject({
      code: "BAD_STATE",
    });
  });

  it("keeps the idempotency ledger private to each operator", async () => {
    const a = await makeOperation();
    const b = await makeOperation();
    const sharedId = opId(); // the same id from two different companies' devices must not collide
    const [ra] = await send(a, [{ clientOpId: sharedId, payload: sale(a, 1) }]);
    const [rb] = await send(b, [{ clientOpId: sharedId, payload: sale(b, 1) }]);
    expect(ra.status).toBe("APPLIED");
    expect(rb.status).toBe("APPLIED");
    expect(ra.duplicate).toBeUndefined();
    expect(rb.duplicate).toBeUndefined();
    expect(await withTenant(a.tenantId, (tx) => tx.syncOperation.findMany())).toHaveLength(1);
  });
});
