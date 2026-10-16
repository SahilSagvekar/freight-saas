"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPasswordAction, type ForgotState } from "@/server/account-actions";

export function ForgotForm() {
  const [state, action] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  if (state.done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email">
          {state.emailConfigured
            ? "If that email has an account, a link is on its way. It works once and expires in 3 days."
            : "Email isn't set up for this service yet. Ask the owner of your account to send you a new sign-in link from the Team page."}
        </Alert>
        <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required autoFocus /></Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending…">Send me a link</SubmitButton>
      <Link href="/login" className="block text-center text-sm text-muted hover:underline">Back to sign in</Link>
    </form>
  );
}
