import { z } from "zod";

/** Shared by server actions, the sync endpoint and the offline form, so all three validate identically. */
export const bookingLineSchema = z.object({
  itemTypeId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(999),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const createBookingSchema = z.object({
  voyageId: z.string().uuid("Choose a voyage"),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  customerId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  /** Total the agent quoted while offline; if the server's price differs, the booking goes to review. */
  quotedTotal: z.number().int().min(0).optional(),
  lines: z.array(bookingLineSchema).min(1, "Add at least one item").max(50),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const syncRequestSchema = z.object({
  deviceId: z.string().min(1).max(100),
  ops: z
    .array(
      z.object({
        clientOpId: z.string().min(8).max(100),
        type: z.literal("CREATE_BOOKING"),
        payload: createBookingSchema,
      }),
    )
    .min(1)
    .max(50),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;
