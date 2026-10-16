/**
 * The plans, in one place. The landing page shows them and billing enforces them.
 * The prices here are EXAMPLES: set your own, then create matching prices in Stripe and put their ids in
 * STRIPE_PRICE_STARTER / STRIPE_PRICE_OPERATOR.
 */
export type PlanId = "starter" | "operator";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyUsd: number;
  tagline: string;
  maxVessels: number;
  maxUsers: number;
  features: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 49,
    tagline: "One boat, a small crew.",
    maxVessels: 1,
    maxUsers: 5,
    features: ["Ticket desk that works offline", "Passenger, vehicle and cargo booking", "Manifests and daily reports", "QR tickets and check-in"],
  },
  {
    id: "operator",
    name: "Operator",
    monthlyUsd: 149,
    tagline: "A fleet and a busy dock.",
    maxVessels: 10,
    maxUsers: 40,
    features: ["Everything in Starter", "Up to 10 vessels and 40 people", "Custom roles and permissions", "Public online booking page", "Priority support"],
  },
];

export const planById = (id: string | null | undefined): Plan | undefined => PLANS.find((p) => p.id === id);
