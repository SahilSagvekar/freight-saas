"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLANS } from "@/lib/plans";
import { REGIONS } from "@/lib/regions";
import { signupAction, type SignupState } from "@/server/signup-actions";

export function SignupForm({ initialPlan }: { initialPlan: string }) {
  const [state, action] = useActionState<SignupState, FormData>(signupAction, {});
  if (state.done) {
    return (
      <div className="space-y-4">
        {state.done.emailFailed ? (
          <Alert tone="warning" title="Your workspace was created, but we couldn't send the email">
            <p>We tried to email a link to {state.done.email} and it didn&apos;t go through, so you can&apos;t choose a password yet.</p>
            <p className="mt-2">
              Try again in a few minutes with <Link href="/forgot-password" className="font-medium underline">Forgot password</Link>, using the same email. If it still doesn&apos;t arrive, contact us and we&apos;ll send you a link.
            </p>
          </Alert>
        ) : state.done.link ? (
          <Alert tone="success" title="Your workspace is ready">
            <p>Email isn&apos;t set up on this server, so here is your one-time link:</p>
            <Link href={state.done.link} className="mt-2 block break-all font-mono text-xs underline">{state.done.link}</Link>
          </Alert>
        ) : (
          <Alert tone="success" title="Check your email">We sent a link to {state.done.email}. Open it to choose your password and sign in.</Alert>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Company name" htmlFor="operator"><Input id="operator" name="operator" required maxLength={80} autoFocus placeholder="e.g. Blue Lagoon Ferries" /></Field>
      <Field label="Your name" htmlFor="name"><Input id="name" name="name" required maxLength={80} autoComplete="name" /></Field>
      <Field label="Work email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What does your company do?</legend>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="kind" value="freight" defaultChecked className="accent-brand-600" />
          <span><span className="font-medium">Freight forwarding</span> <span className="text-muted">· inquiries, quotes, shipments and documents</span></span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="kind" value="ferry" className="accent-brand-600" />
          <span><span className="font-medium">Ferry or passenger boat</span> <span className="text-muted">· tickets and manifests</span></span>
        </label>
      </fieldset>
      <Field label="Where do you operate?" htmlFor="region" hint="Sets your currency and time zone.">
        <Select id="region" name="region" required defaultValue="">
          <option value="" disabled>Choose a country…</option>
          {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name} · {r.currency}</option>)}
        </Select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Plan</legend>
        {PLANS.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="plan" value={p.id} defaultChecked={p.id === initialPlan} className="accent-brand-600" />
            <span><span className="font-medium">{p.name}</span> · ${p.monthlyUsd}/mo after your trial <span className="text-muted">· {p.maxVessels} {p.maxVessels === 1 ? "vessel" : "vessels"}</span></span>
          </label>
        ))}
      </fieldset>
      {/* Bots fill this in; people never see it. */}
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Checkbox name="terms" label="I agree to the terms and privacy policy" required />
      <p className="-mt-2 text-xs text-muted"><Link href="/terms" target="_blank" className="underline">Terms</Link> · <Link href="/privacy" target="_blank" className="underline">Privacy</Link></p>
      <SubmitButton size="lg" className="w-full" pendingText="Creating your workspace…">Create my workspace</SubmitButton>
      <p className="text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></p>
    </form>
  );
}
