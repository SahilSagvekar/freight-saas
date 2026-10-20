"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { verifyAdminCodeAction, type AdminCodeState } from "@/server/admin-2fa-actions";

export function VerifyForm() {
  const [state, action] = useActionState<AdminCodeState, FormData>(verifyAdminCodeAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Authentication code" htmlFor="code">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Checking…">Open the console</SubmitButton>
    </form>
  );
}
