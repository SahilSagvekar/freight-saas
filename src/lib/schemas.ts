import { z } from "zod";
import { TRANSPORT_MODES } from "./domain";

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
  contactEmail: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
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

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** What a visitor sends from the website form. Everything the forwarder needs for a first quote, nothing more. */
export const inquirySchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: optionalText(40),
  company: optionalText(120),
  mode: z.enum(TRANSPORT_MODES, { message: "Choose how you want to ship" }),
  origin: z.string().trim().min(1, "Where is it going from?").max(120),
  destination: z.string().trim().min(1, "Where is it going to?").max(120),
  cargo: z.string().trim().min(1, "Tell us what you are shipping").max(500),
  weightKg: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().positive("Weight must be more than 0").max(10_000_000).optional(),
  ),
  readyOn: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31").optional()),
  message: optionalText(2000),
});
export type InquiryInput = z.infer<typeof inquirySchema>;
