import type { z } from "zod";

/** Zod's issue paths ("packages.0.quantity") become form field keys, so a form can mark the right box. First message per field wins. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
