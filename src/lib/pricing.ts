import type { ItemKind, TaxAppliesTo } from "./domain";

export type PriceRuleLike = {
  itemTypeId: string;
  originId: string | null;
  destinationId: string | null;
  unitPrice: number;
  active: boolean;
};

/**
 * Picks the most specific active price for an item on a route.
 * Exact route beats a one-sided match, which beats an "any route" rule. When two rules are equally
 * specific the first one in the list wins, so callers pass rules newest-first.
 */
export function resolveUnitPrice(
  rules: PriceRuleLike[],
  query: { itemTypeId: string; originId: string; destinationId: string },
): number | null {
  let best: { score: number; price: number } | null = null;
  for (const rule of rules) {
    if (!rule.active || rule.itemTypeId !== query.itemTypeId) continue;
    if (rule.originId !== null && rule.originId !== query.originId) continue;
    if (rule.destinationId !== null && rule.destinationId !== query.destinationId) continue;
    const score = (rule.originId !== null ? 1 : 0) + (rule.destinationId !== null ? 1 : 0);
    if (best === null || score > best.score) best = { score, price: rule.unitPrice };
  }
  return best ? best.price : null;
}

export type TaxRuleLike = {
  name: string;
  rateBp: number;
  appliesTo: TaxAppliesTo;
  inclusive: boolean;
  active: boolean;
};

export type LineAmounts = { subtotal: number; taxAmount: number; total: number };

/**
 * Prices one booking line in minor units.
 * Inclusive taxes are already inside the listed price (so the net amount is carved out of it);
 * exclusive taxes are added on top of the net amount.
 */
export function computeLine(input: {
  unitPrice: number;
  quantity: number;
  kind: ItemKind;
  taxRules: TaxRuleLike[];
}): LineAmounts {
  const applicable = input.taxRules.filter(
    (rule) => rule.active && (rule.appliesTo === "ALL" || rule.appliesTo === input.kind),
  );
  const gross = input.unitPrice * input.quantity;
  const inclusiveBp = applicable.filter((r) => r.inclusive).reduce((sum, r) => sum + r.rateBp, 0);
  const exclusiveBp = applicable.filter((r) => !r.inclusive).reduce((sum, r) => sum + r.rateBp, 0);

  const net = inclusiveBp > 0 ? Math.round((gross * 10000) / (10000 + inclusiveBp)) : gross;
  const inclusiveTax = gross - net;
  const exclusiveTax = Math.round((net * exclusiveBp) / 10000);
  const taxAmount = inclusiveTax + exclusiveTax;
  return { subtotal: net, taxAmount, total: net + taxAmount };
}

export function sumLines(lines: LineAmounts[]): LineAmounts {
  return lines.reduce(
    (acc, line) => ({
      subtotal: acc.subtotal + line.subtotal,
      taxAmount: acc.taxAmount + line.taxAmount,
      total: acc.total + line.total,
    }),
    { subtotal: 0, taxAmount: 0, total: 0 },
  );
}
