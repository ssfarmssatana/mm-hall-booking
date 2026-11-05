"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LABELS, PROGRAMME_TYPES, type Enquiry, type Hall, type Profile } from "@/lib/types";
import { createEnquiry, updateEnquiry, type ActionState } from "./actions";

export function EnquiryForm({ halls, profiles, enquiry, onDone }: { halls: Hall[]; profiles: Profile[]; enquiry?: Enquiry; onDone?: () => void }) {
  const action = enquiry ? updateEnquiry.bind(null, enquiry.id) : createEnquiry;
  const [state, formAction, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = await action(p, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  const e = enquiry;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Customer name" required><Input name="customer_name" defaultValue={e?.customer_name} required autoFocus /></Field>
      <Field label="Mobile" required><Input name="mobile" type="tel" inputMode="tel" defaultValue={e?.mobile} required /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={e?.email ?? ""} /></Field>
      <Field label="Enquiry source">
        <Select name="source" defaultValue={e?.source ?? "phone"}>
          {Object.entries(LABELS.enquirySource).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={e?.address ?? ""} /></Field>

      <Field label="Programme type">
        <Input name="programme_type" list="programme-types" defaultValue={e?.programme_type ?? ""} />
        <datalist id="programme-types">{PROGRAMME_TYPES.map((p) => <option key={p} value={p} />)}</datalist>
      </Field>
      <Field label="Preferred hall">
        <Select name="preferred_hall_id" defaultValue={e?.preferred_hall_id ?? ""}>
          <option value="">Not decided</option>
          {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </Field>
      <Field label="Event date"><Input name="event_date" type="date" defaultValue={e?.event_date ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><Input name="start_time" type="time" defaultValue={e?.start_time?.slice(0, 5) ?? ""} /></Field>
        <Field label="To"><Input name="end_time" type="time" defaultValue={e?.end_time?.slice(0, 5) ?? ""} /></Field>
      </div>
      <Field label="Expected guests"><Input name="expected_guests" type="number" min={0} defaultValue={e?.expected_guests ?? ""} /></Field>
      <Field label="Quoted amount (₹)"><Input name="quoted_amount" type="number" min={0} step="1" defaultValue={e?.quoted_amount ?? ""} /></Field>
      <Field label="Next follow-up"><Input name="next_follow_up" type="date" defaultValue={e?.next_follow_up ?? ""} /></Field>
      <Field label="Handled by">
        <Select name="assigned_to" defaultValue={e?.assigned_to ?? ""}>
          <option value="">Me</option>
          {profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
      </Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={e?.notes ?? ""} rows={3} /></Field>

      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{state.error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : e ? "Save changes" : "Save enquiry"}</Button>
      </div>
    </form>
  );
}
