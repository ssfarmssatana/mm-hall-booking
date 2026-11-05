"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Hall, Settings } from "@/lib/types";
import { inr } from "@/lib/format";
import { saveHall, saveSettings, toggleHall } from "./actions";
import type { ActionState } from "../enquiries/actions";

export function SettingsForm({ settings, counters }: { settings: Settings; counters: Record<string, number> }) {
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => { const r = await saveSettings(p, fd); if (r?.ok) toast.success("Settings saved"); return r; }, null);
  const s = (k: string) => String(settings[k] ?? "");
  return (
    <form action={action}>
      <Card>
        <CardHeader><CardTitle>Mandal & billing</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Organisation name"><Input name="org_name" defaultValue={s("org_name")} /></Field>
          <Field label="Name in Marathi"><Input name="org_name_mr" defaultValue={s("org_name_mr")} /></Field>
          <Field label="Address (printed on receipts)" className="sm:col-span-2"><Input name="org_address" defaultValue={s("org_address")} /></Field>
          <Field label="Phone"><Input name="org_phone" defaultValue={s("org_phone")} /></Field>
          <Field label="Email"><Input name="org_email" defaultValue={s("org_email")} /></Field>
          <Field label="GSTIN"><Input name="gstin" defaultValue={s("gstin")} /></Field>
          <Field label="GST rate (%)" hint="Split equally as CGST + SGST on documents"><Input name="gst_rate" type="number" step="0.01" defaultValue={s("gst_rate")} /></Field>
          <Field label="Setup / cleaning buffer (minutes)" hint="Added before and after every booking when checking clashes"><Input name="buffer_minutes" type="number" defaultValue={s("buffer_minutes")} /></Field>
          <Field label="Tentative hold (days)" hint="Holds expire after this many days unless confirmed"><Input name="tentative_hold_days" type="number" defaultValue={s("tentative_hold_days")} /></Field>
          <Field label="Terms (English)" className="sm:col-span-2"><Textarea name="terms" rows={5} defaultValue={s("terms")} /></Field>
          <Field label="Terms (Marathi)" className="sm:col-span-2"><Textarea name="terms_mr" rows={5} defaultValue={s("terms_mr")} /></Field>
          <div className="sm:col-span-2 mt-2 text-sm font-semibold">Running numbers (last used)</div>
          <Field label="Last booking no."><Input name="counter_booking" type="number" defaultValue={counters.booking ?? 0} /></Field>
          <Field label="Last receipt no."><Input name="counter_receipt" type="number" defaultValue={counters.receipt ?? 0} /></Field>
          <Field label="Last enquiry no."><Input name="counter_enquiry" type="number" defaultValue={counters.enquiry ?? 0} /></Field>
          {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{state.error}</p>}
          <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button></div>
        </CardContent>
      </Card>
    </form>
  );
}

export function HallsManager({ halls }: { halls: Hall[] }) {
  const [editing, setEditing] = useState<Hall | null | "new">(null);
  return (
    <Card>
      <CardHeader><CardTitle>Halls</CardTitle><Button size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus /> Add hall</Button></CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line text-sm">
          {halls.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-block size-3 rounded-full" style={{ background: h.color }} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{h.name} {h.name_mr && <span className="text-muted">· {h.name_mr}</span>} {!h.active && <span className="ml-1 rounded bg-surface-2 px-1.5 text-xs text-muted">inactive</span>}</div>
                <div className="text-xs text-muted">{h.floor} · {h.capacity ?? "—"} guests · {h.is_ac ? "AC" : "Non-AC"} · base {inr(h.base_rate)} · deposit {inr(h.deposit_default)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toggleHall(h.id, !h.active)}>{h.active ? "Deactivate" : "Activate"}</Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(h)} aria-label="Edit"><Pencil /></Button>
            </li>
          ))}
        </ul>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === "new" ? "Add hall" : "Edit hall"}>
          <HallForm hall={editing === "new" ? undefined : editing ?? undefined} onDone={() => setEditing(null)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HallForm({ hall, onDone }: { hall?: Hall; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => { const r = await saveHall(p, fd); if (r?.ok) { toast.success("Hall saved"); onDone(); } return r; }, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {hall && <input type="hidden" name="id" value={hall.id} />}
      <Field label="Name" required><Input name="name" defaultValue={hall?.name} required autoFocus /></Field>
      <Field label="Name in Marathi"><Input name="name_mr" defaultValue={hall?.name_mr ?? ""} /></Field>
      <Field label="Floor"><Input name="floor" defaultValue={hall?.floor ?? ""} /></Field>
      <Field label="Capacity (guests)"><Input name="capacity" type="number" defaultValue={hall?.capacity ?? ""} /></Field>
      <Field label="Standard charges (₹)"><Input name="base_rate" type="number" defaultValue={hall?.base_rate ?? 0} /></Field>
      <Field label="Standard deposit (₹)"><Input name="deposit_default" type="number" defaultValue={hall?.deposit_default ?? 0} /></Field>
      <Field label="Calendar colour"><Input name="color" type="color" defaultValue={hall?.color ?? "#2563eb"} className="h-10 p-1" /></Field>
      <Field label="Sort order"><Input name="sort_order" type="number" defaultValue={hall?.sort_order ?? 0} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_ac" defaultChecked={hall?.is_ac} /> Air-conditioned</label>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{state.error}</p>}
      <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={pending}>Save hall</Button></div>
    </form>
  );
}
