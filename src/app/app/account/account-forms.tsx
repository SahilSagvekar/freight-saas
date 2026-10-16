"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { changePasswordAction, signOutEverywhereAction, type AccountState } from "@/server/account-actions";

export function AccountForms() {
  const [state, action] = useActionState<AccountState, FormData>(changePasswordAction, {});
  return (
    <>
      <Card>
        <CardHeader title="Change password" description="Other devices are signed out when you change it." />
        <CardBody>
          <form action={action} className="space-y-4">
            {state.error && <Alert tone="error">{state.error}</Alert>}
            {state.ok && <Alert tone="success">{state.ok}</Alert>}
            <Field label="Current password" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
            <Field label="New password" htmlFor="next" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}><Input id="next" name="next" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /></Field>
            <Field label="New password again" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /></Field>
            <SubmitButton pendingText="Saving…">Change password</SubmitButton>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Sign out everywhere" description="Lost a phone or used a shared computer? This ends every session, including this one." />
        <CardBody>
          <form action={signOutEverywhereAction}><Button variant="secondary" type="submit">Sign out of all devices</Button></form>
        </CardBody>
      </Card>
    </>
  );
}
