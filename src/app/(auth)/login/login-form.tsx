"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { chooseOperatorAction, loginAction, type LoginState } from "@/server/session-actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  const [picked, pick] = useActionState<LoginState, FormData>(chooseOperatorAction, {});

  // A failed pick (the 10-minute window ran out) sends them back to the password form.
  if (state.choose && !picked.error) {
    const { token, next: target, options } = state.choose;
    return (
      <form action={pick} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={target} />
        <p className="text-sm text-muted">Your account works for more than one operator. Which one do you want to open?</p>
        {options.map((o) => (
          <Button key={o.mid} type="submit" name="mid" value={o.mid} variant="secondary" size="lg" className="h-auto w-full justify-start gap-3 py-3 text-left">
            <Building2 className="size-5 shrink-0 text-subtle" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{o.tenantName}</span>
              <span className="block truncate text-sm font-normal text-muted">{o.roleName}</span>
            </span>
          </Button>
        ))}
      </form>
    );
  }

  const error = picked.error ?? state.error;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {notice && !error && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <Link href="/forgot-password" className="block text-center text-sm text-muted hover:underline">Forgot your password?</Link>
    </form>
  );
}
