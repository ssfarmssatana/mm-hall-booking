"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { restoreBackup, restoreFromStorage } from "./actions";
import type { ActionState } from "../enquiries/actions";

export function RestoreForm() {
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => { const r = await restoreBackup(p, fd); if (r?.ok) toast.success("Data restored"); return r; }, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <p className="text-sm text-ink-2 sm:col-span-3">Restoring <b>replaces all current enquiries, bookings, payments and settings</b> with the contents of the file. User accounts are not changed. Download a fresh backup first.</p>
      <Field label="Backup file (.json)"><Input name="file" type="file" accept="application/json,.json" required className="py-1.5" /></Field>
      <Field label="Type RESTORE to confirm"><Input name="confirm" placeholder="RESTORE" required /></Field>
      <div className="flex items-end"><Button variant="danger" type="submit" disabled={pending}>{pending ? "Restoring…" : "Restore from file"}</Button></div>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-3">{state.error}</p>}
    </form>
  );
}

export function RestoreFromStorageButton({ name }: { name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => {
      if (!window.confirm(`Replace ALL current data with the backup ${name}? This cannot be undone.`)) return;
      start(async () => { const r = await restoreFromStorage(name); if (r?.error) toast.error(r.error); else toast.success("Data restored"); });
    }}>{pending ? "Restoring…" : "Restore"}</Button>
  );
}
