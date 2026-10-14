"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { setPasswordAction, type SetPasswordState } from "@/server/setup-actions";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState<SetPasswordState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" value={email} readOnly disabled autoComplete="username" />
      </Field>
      <Field label="Choose a password" htmlFor="password" hint={`At least ${MIN_PASSWORD_LENGTH} characters. A few words in a row works well.`}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required autoFocus />
      </Field>
      <Field label="Type it again" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}
