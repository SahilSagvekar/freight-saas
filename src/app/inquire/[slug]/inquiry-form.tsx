"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TurnstileField } from "@/components/turnstile-field";
import { MODE_LABELS, TRANSPORT_MODES } from "@/lib/domain";
import { submitInquiryAction, type InquiryFormState } from "@/server/inquiry-actions";

export function InquiryForm({ slug, captchaSiteKey }: { slug: string; captchaSiteKey?: string }) {
  const [state, action] = useActionState<InquiryFormState, FormData>(submitInquiryAction.bind(null, slug), {});
  const err = (k: string) => state.fields?.[k];

  if (state.done) {
    return (
      <Alert tone="success" title="Request received">
        {state.done.message}
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" required error={err("name")}><Input id="name" name="name" required maxLength={120} autoComplete="name" /></Field>
        <Field label="Email" htmlFor="email" required error={err("email")}><Input id="email" name="email" type="email" required maxLength={200} autoComplete="email" /></Field>
        <Field label="Phone" htmlFor="phone" hint="Optional" error={err("phone")}><Input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" /></Field>
        <Field label="Company" htmlFor="company" hint="Optional" error={err("company")}><Input id="company" name="company" maxLength={120} autoComplete="organization" /></Field>
      </div>
      <Field label="How do you want to ship?" htmlFor="mode" required error={err("mode")}>
        <Select id="mode" name="mode" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="origin" required hint="City, port or airport" error={err("origin")}><Input id="origin" name="origin" required maxLength={120} /></Field>
        <Field label="To" htmlFor="destination" required hint="City, port or airport" error={err("destination")}><Input id="destination" name="destination" required maxLength={120} /></Field>
      </div>
      <Field label="What are you shipping?" htmlFor="cargo" required error={err("cargo")}><Textarea id="cargo" name="cargo" required maxLength={500} rows={3} placeholder="e.g. 12 pallets of ceramic tiles" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Approximate weight (kg)" htmlFor="weightKg" hint="Optional" error={err("weightKg")}><Input id="weightKg" name="weightKg" inputMode="decimal" /></Field>
        <Field label="Ready to ship on" htmlFor="readyOn" hint="Optional" error={err("readyOn")}><Input id="readyOn" name="readyOn" type="date" /></Field>
      </div>
      <Field label="Anything else we should know?" htmlFor="message" hint="Optional" error={err("message")}><Textarea id="message" name="message" maxLength={2000} rows={3} /></Field>
      {/* Bots fill this in; people never see it. */}
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <TurnstileField siteKey={captchaSiteKey} resetSignal={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Sending…">Send request</SubmitButton>
    </form>
  );
}
