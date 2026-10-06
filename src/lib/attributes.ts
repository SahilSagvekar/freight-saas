import type { FieldDef } from "./domain";

export type AttributeValue = string | number | boolean;
export type AttributeResult =
  | { ok: true; value: Record<string, AttributeValue> }
  | { ok: false; errors: Record<string, string> };

const MAX_TEXT = 200;

/**
 * Validates the operator-defined extra fields on a booking line against the item type's schema.
 * Unknown keys are dropped, values are coerced from form strings, and every problem is reported by field key.
 */
export function validateAttributes(fields: FieldDef[], raw: Record<string, unknown> | undefined): AttributeResult {
  const input = raw ?? {};
  const value: Record<string, AttributeValue> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const given = input[field.key];
    const empty = given === undefined || given === null || given === "" || (field.type === "boolean" && given === false);

    if (field.type === "boolean") {
      const on = given === true || given === "true" || given === "on";
      if (field.required && !on) errors[field.key] = `${field.label} is required`;
      else value[field.key] = on;
      continue;
    }

    if (empty) {
      if (field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }

    if (field.type === "number") {
      const n = typeof given === "number" ? given : Number(String(given).trim());
      if (!Number.isFinite(n)) errors[field.key] = `${field.label} must be a number`;
      else value[field.key] = n;
    } else if (field.type === "select") {
      const text = String(given);
      if (!field.options?.includes(text)) errors[field.key] = `Choose a valid ${field.label.toLowerCase()}`;
      else value[field.key] = text;
    } else {
      const text = String(given).trim();
      if (text.length > MAX_TEXT) errors[field.key] = `${field.label} is too long`;
      else if (text.length === 0 && field.required) errors[field.key] = `${field.label} is required`;
      else if (text.length > 0) value[field.key] = text;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** Short human summary of a line's attributes, e.g. "Container no.: ABCD123 · Size: 40ft". */
export function describeAttributes(fields: FieldDef[], attributes: Record<string, AttributeValue>): string {
  return fields
    .filter((f) => attributes[f.key] !== undefined && attributes[f.key] !== "" && attributes[f.key] !== false)
    .map((f) => (f.type === "boolean" ? f.label : `${f.label}: ${attributes[f.key]}`))
    .join(" · ");
}
