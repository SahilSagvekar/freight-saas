"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLANS } from "@/lib/plans";
import { manageBillingAction, subscribeAction, type BillingActionState } from "@/server/billing-actions";

export function BillingActions({ hasCustomer, active, currentPlan, configured }: { hasCustomer: boolean; active: boolean; currentPlan: string; configured: boolean }) {
  const [state, action] = useActionState<BillingActionState, FormData>(subscribeAction, {});
  if (!configured) return <Alert tone="info" title="Billing isn't switched on yet">Contact support to subscribe or change plan.</Alert>;
  return (
    <>
      {active && hasCustomer && (
        <Card>
          <CardHeader title="Payment details" description="Update your card, download invoices, change plan or cancel." />
          <CardBody><form action={manageBillingAction}><Button type="submit" variant="secondary">Manage billing</Button></form></CardBody>
        </Card>
      )}
      {!active && (
        <Card>
          <CardHeader title="Choose a plan" description="Monthly. Cancel any time." />
          <CardBody>
            <form action={action} className="space-y-3">
              {state.error && <Alert tone="error">{state.error}</Alert>}
              <div className="grid gap-3 sm:grid-cols-2">
                {PLANS.map((p) => (
                  <label key={p.id} className="flex cursor-pointer gap-3 rounded-lg border border-line p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="radio" name="plan" value={p.id} defaultChecked={p.id === currentPlan} className="mt-1 accent-brand-600" />
                    <span><span className="block font-semibold">{p.name} · ${p.monthlyUsd}/mo</span><span className="block text-sm text-muted">{p.maxVessels} {p.maxVessels === 1 ? "vessel" : "vessels"}, up to {p.maxUsers} people</span></span>
                  </label>
                ))}
              </div>
              <SubmitButton pendingText="Opening checkout…">Continue to payment</SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}
    </>
  );
}
