import { afterAll, describe, expect, it } from "vitest";
import { closeDb, withTenant } from "@/db";
import { BookingError, cancelBooking, createBooking, recordPayment, setManifestStatus, usedCapacity } from "@/server/bookings";
import { addTax, makeOperation } from "./helpers";

afterAll(closeDb);

const online = (op: Awaited<ReturnType<typeof makeOperation>>) => ({ ...op.ctx, source: "ONLINE" as const });

describe("createBooking", () => {
  it("prices lines, issues an invoice and a manifest entry per line", async () => {
    const op = await makeOperation();
    await addTax(op.tenantId, { name: "VAT", rateBp: 1200 });

    const result = await withTenant(op.tenantId, (tx) =>
      createBooking(tx, online(op), {
        voyageId: op.voyage.id,
        contactName: "Maria Rolle",
        lines: [
          { itemTypeId: op.type("Adult").id, quantity: 2 },
          { itemTypeId: op.type("Car").id, quantity: 1, attributes: { plate: "ABC 123" } },
        ],
      }),
    );

    // 2 x 25.00 + 1 x 60.00 = 110.00, plus 12% VAT = 123.20
    expect(result.status).toBe("CONFIRMED");
    expect(result.total).toBe(12320);
    expect(result.bookingNo).toBe("BK-00001");
    expect(result.invoiceId).toBeTruthy();

    await withTenant(op.tenantId, async (tx) => {
      const manifest = await tx.manifestEntry.findMany();
      expect(manifest).toHaveLength(2);
      expect(manifest.every((m) => m.status === "PENDING")).toBe(true);
      const [invoice] = await tx.invoice.findMany();
      expect(invoice.total).toBe(12320);
      expect(invoice.status).toBe("UNPAID");
      const used = await usedCapacity(tx, op.voyage.id);
      expect(used).toEqual({ PASSENGER: 2, VEHICLE: 1, CARGO: 0 });
    });
  });

  it("numbers bookings per tenant, so two operators can both have booking 1", async () => {
    const a = await makeOperation();
    const b = await makeOperation();
    const make = (op: typeof a) =>
      withTenant(op.tenantId, (tx) =>
        createBooking(tx, online(op), {
          voyageId: op.voyage.id,
          contactName: "X",
          lines: [{ itemTypeId: op.type("Adult").id, quantity: 1 }],
        }),
      );
    expect((await make(a)).bookingNo).toBe("BK-00001");
    expect((await make(b)).bookingNo).toBe("BK-00001");
    expect((await make(a)).bookingNo).toBe("BK-00002");
  });

  it("refuses an online sale that does not fit, and says how much room is left", async () => {
    const op = await makeOperation({ PASSENGER: 3, VEHICLE: 1, CARGO: 1 });
    const book = (qty: number) =>
      withTenant(op.tenantId, (tx) =>
        createBooking(tx, online(op), {
          voyageId: op.voyage.id,
          contactName: "X",
          lines: [{ itemTypeId: op.type("Adult").id, quantity: qty }],
        }),
      );
    await book(2);
    await expect(book(2)).rejects.toMatchObject({ code: "FULL", message: expect.stringContaining("1 left") });
    await expect(book(1)).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("never oversells under concurrent requests", async () => {
    const op = await makeOperation({ PASSENGER: 3, VEHICLE: 1, CARGO: 1 });
    const attempt = () =>
      withTenant(op.tenantId, (tx) =>
        createBooking(tx, online(op), {
          voyageId: op.voyage.id,
          contactName: "Racer",
          lines: [{ itemTypeId: op.type("Adult").id, quantity: 1 }],
        }),
      );
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, attempt));
    const ok = outcomes.filter((o) => o.status === "fulfilled");
    const refused = outcomes.filter((o) => o.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(5);
    expect(refused.every((r) => (r as PromiseRejectedResult).reason instanceof BookingError)).toBe(true);
  });

  it("validates operator-defined fields and reports them by line", async () => {
    const op = await makeOperation();
    const error = await withTenant(op.tenantId, (tx) =>
      createBooking(tx, online(op), {
        voyageId: op.voyage.id,
        contactName: "X",
        lines: [{ itemTypeId: op.type("Container").id, quantity: 1, attributes: { size: "60 ft" } }],
      }),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(BookingError);
    expect(error.code).toBe("INVALID_ATTRIBUTES");
    expect(Object.keys(error.fields).sort()).toEqual(["lines.0.containerNo", "lines.0.size"]);
  });

  it("refuses an item that has no price on the route", async () => {
    const op = await makeOperation();
    const unpriced = await withTenant(op.tenantId, (tx) =>
      tx.itemType.create({ data: { tenantId: op.tenantId, kind: "CARGO", name: "Mystery crate" } }),
    );
    await expect(
      withTenant(op.tenantId, (tx) =>
        createBooking(tx, online(op), {
          voyageId: op.voyage.id,
          contactName: "X",
          lines: [{ itemTypeId: unpriced.id, quantity: 1 }],
        }),
      ),
    ).rejects.toMatchObject({ code: "NO_PRICE" });
  });

  it("refuses a voyage that belongs to another operator", async () => {
    const a = await makeOperation();
    const b = await makeOperation();
    await expect(
      withTenant(a.tenantId, (tx) =>
        createBooking(tx, online(a), {
          voyageId: b.voyage.id,
          contactName: "X",
          lines: [{ itemTypeId: a.type("Adult").id, quantity: 1 }],
        }),
      ),
    ).rejects.toMatchObject({ code: "VOYAGE_NOT_FOUND" });
  });
});

describe("payments, cancellation and manifest", () => {
  async function paidSetup() {
    const op = await makeOperation();
    const booking = await withTenant(op.tenantId, (tx) =>
      createBooking(tx, online(op), {
        voyageId: op.voyage.id,
        contactName: "Pat",
        lines: [{ itemTypeId: op.type("Pallet").id, quantity: 1, attributes: { contents: "Cement" } }],
      }),
    );
    return { op, booking };
  }

  it("moves the invoice through partial to paid and rejects overpayment", async () => {
    const { op, booking } = await paidSetup(); // pallet = 120.00
    const pay = (amount: number) =>
      withTenant(op.tenantId, (tx) => recordPayment(tx, op.ctx, booking.invoiceId!, { method: "CASH", amount }));

    expect(await pay(5000)).toEqual({ status: "PARTIAL", outstanding: 7000 });
    await expect(pay(7001)).rejects.toMatchObject({ code: "OVERPAYMENT" });
    await expect(pay(0)).rejects.toMatchObject({ code: "INVALID" });
    expect(await pay(7000)).toEqual({ status: "PAID", outstanding: 0 });

    const rows = await withTenant(op.tenantId, (tx) => tx.payment.findMany());
    expect(rows.map((r) => r.amount).sort()).toEqual([5000, 7000]);
  });

  it("cancelling frees capacity and voids the invoice; paid bookings cannot be cancelled", async () => {
    const { op, booking } = await paidSetup();
    await withTenant(op.tenantId, (tx) => cancelBooking(tx, op.ctx, booking.bookingId));

    await withTenant(op.tenantId, async (tx) => {
      expect((await usedCapacity(tx, op.voyage.id)).CARGO).toBe(0);
      const [inv] = await tx.invoice.findMany({ where: { id: booking.invoiceId! } });
      expect(inv.status).toBe("VOID");
      expect(await tx.manifestEntry.findMany()).toHaveLength(0);
    });
    await expect(
      withTenant(op.tenantId, (tx) => recordPayment(tx, op.ctx, booking.invoiceId!, { method: "CASH", amount: 100 })),
    ).rejects.toMatchObject({ code: "BAD_STATE" });

    const second = await paidSetup();
    await withTenant(second.op.tenantId, (tx) =>
      recordPayment(tx, second.op.ctx, second.booking.invoiceId!, { method: "CASH", amount: 100 }),
    );
    await expect(
      withTenant(second.op.tenantId, (tx) => cancelBooking(tx, second.op.ctx, second.booking.bookingId)),
    ).rejects.toMatchObject({ code: "HAS_PAYMENTS" });
    const [still] = await withTenant(second.op.tenantId, (tx) =>
      tx.booking.findMany({ where: { id: second.booking.bookingId } }),
    );
    expect(still.status).toBe("CONFIRMED");
  });

  it("walks the manifest and requires a receiver for delivery", async () => {
    const { op } = await paidSetup();
    const [entry] = await withTenant(op.tenantId, (tx) => tx.manifestEntry.findMany());
    const set = (status: "LOADED" | "UNLOADED" | "DELIVERED", details = {}) =>
      withTenant(op.tenantId, (tx) => setManifestStatus(tx, op.ctx, entry.id, status, details));

    await set("LOADED");
    await set("UNLOADED");
    await expect(set("DELIVERED")).rejects.toMatchObject({ code: "INVALID" });
    await set("DELIVERED", { receivedBy: "J. Smith" });

    const [done] = await withTenant(op.tenantId, (tx) => tx.manifestEntry.findMany());
    expect(done.status).toBe("DELIVERED");
    expect(done.receivedBy).toBe("J. Smith");
    expect(done.loadedAt).toBeTruthy();
    expect(done.deliveredAt).toBeTruthy();
  });
});
