"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-surface p-6 shadow-sm">
      <input type="hidden" name="next" value={next || "/dashboard"} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
