"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { LABELS, type Profile } from "@/lib/types";
import { createUser, updateUser } from "./actions";
import type { ActionState } from "../enquiries/actions";

export function UsersManager({ profiles, meId }: { profiles: Profile[]; meId: string }) {
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setEditing("new")}><Plus /> Add user</Button></div>
      <div className="rounded-lg border border-line bg-surface">
        <ul className="divide-y divide-line text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{p.full_name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><div className="font-medium">{p.full_name} {p.id === meId && <span className="text-xs text-muted">(you)</span>}</div><div className="truncate text-xs text-muted">{p.email}</div></div>
              <Badge variant={p.role === "admin" ? "accent" : p.role === "accounts" ? "ok" : "default"}>{LABELS.role[p.role]}</Badge>
              {!p.active && <Badge variant="danger">Inactive</Badge>}
              <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Edit"><Pencil /></Button>
            </li>
          ))}
        </ul>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === "new" ? "Add user" : "Edit user"} description={editing === "new" ? "Set a password and share it with the staff member. No email is sent." : undefined}>
          {editing && <UserForm user={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserForm({ user, onDone }: { user?: Profile; onDone: () => void }) {
  const fn = user ? updateUser.bind(null, user.id) : createUser;
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => { const r = await fn(p, fd); if (r?.ok) { toast.success("User saved"); onDone(); } return r; }, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Full name" required><Input name="full_name" defaultValue={user?.full_name} required autoFocus /></Field>
      {!user && <Field label="Email (login)" required><Input name="email" type="email" required /></Field>}
      <Field label="Role">
        <Select name="role" defaultValue={user?.role ?? "staff"}>
          <option value="staff">Staff – enquiries & bookings</option>
          <option value="accounts">Accounts – plus payments, discounts, cancellations</option>
          <option value="admin">Administrator – everything</option>
        </Select>
      </Field>
      <Field label={user ? "New password (leave blank to keep)" : "Password"} required={!user}><Input name="password" type="text" autoComplete="new-password" minLength={8} required={!user} placeholder="At least 8 characters" /></Field>
      {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user.active} /> Active (can sign in)</label>}
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save user"}</Button></div>
    </form>
  );
}
