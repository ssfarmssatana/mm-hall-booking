"use client";

import { useActionState, useState } from "react";
import { ArrowRightCircle, Pencil, PhoneForwarded, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LOST_REASONS, type Enquiry, type Hall, type Profile } from "@/lib/types";
import { EnquiryForm } from "../enquiry-form";
import { addFollowup, convertEnquiry, reopenEnquiry, type ActionState } from "../actions";
import { inr, localISO } from "@/lib/format";

export function EnquiryDetailActions({ enquiry, halls, profiles, gstRate }: { enquiry: Enquiry; halls: Hall[]; profiles: Profile[]; gstRate: number }) {
  const [edit, setEdit] = useState(false);
  const [fu, setFu] = useState(false);
  const [conv, setConv] = useState(false);
  const closed = enquiry.status === "booked" || enquiry.status === "lost";

  return (
    <>
      {!closed && <Button variant="secondary" onClick={() => setFu(true)}><PhoneForwarded /> Log follow-up</Button>}
      {!closed && <Button onClick={() => setConv(true)}><ArrowRightCircle /> Convert to booking</Button>}
      {enquiry.status === "lost" && <Button variant="secondary" onClick={() => reopenEnquiry(enquiry.id)}><RotateCcw /> Reopen</Button>}
      <Button variant="ghost" size="icon" onClick={() => setEdit(true)} aria-label="Edit"><Pencil /></Button>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Edit enquiry" className="max-w-2xl">
          <EnquiryForm halls={halls} profiles={profiles} enquiry={enquiry} onDone={() => setEdit(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={fu} onOpenChange={setFu}>
        <DialogContent title="Log follow-up" description="What happened on this call, and when to call next.">
          <FollowupForm enquiry={enquiry} onDone={() => setFu(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={conv} onOpenChange={setConv}>
        <DialogContent title="Convert to booking" description="Customer details carry over. Confirm the slot and charges.">
          <ConvertForm enquiry={enquiry} halls={halls} gstRate={gstRate} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function FollowupForm({ enquiry, onDone }: { enquiry: Enquiry; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"follow_up" | "lost">("follow_up");
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = await addFollowup(enquiry.id, p, fd);
    if (r?.ok) onDone();
    return r;
  }, null);
  const [nextDate] = useState(() => localISO(new Date(Date.now() + 2 * 86400e3)));
  return (
    <form action={action} className="space-y-3">
      <Field label="Note" required><Textarea name="note" rows={3} placeholder="e.g. Spoke to Mr. Patil, will confirm after discussing with family." required autoFocus /></Field>
      <Field label="Outcome">
        <Select name="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as "follow_up" | "lost")}>
          <option value="follow_up">Still interested – follow up again</option>
          <option value="lost">Lost – close enquiry</option>
        </Select>
      </Field>
      {outcome === "follow_up" ? (
        <Field label="Next follow-up date" required><Input name="next_follow_up" type="date" defaultValue={nextDate} required /></Field>
      ) : (
        <Field label="Reason" required>
          <Select name="lost_reason" required>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
        </Field>
      )}
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save follow-up"}</Button></div>
    </form>
  );
}

function ConvertForm({ enquiry, halls, gstRate }: { enquiry: Enquiry; halls: Hall[]; gstRate: number }) {
  const [state, action, pending] = useActionState(convertEnquiry.bind(null, enquiry.id), null);
  const [hallId, setHallId] = useState(enquiry.preferred_hall_id ?? halls[0]?.id);
  const hall = halls.find((h) => h.id === Number(hallId));
  const [charges, setCharges] = useState<number>(enquiry.quoted_amount ?? hall?.base_rate ?? 0);
  const [deposit, setDeposit] = useState<number>(hall?.deposit_default ?? 0);
  const gst = Math.round(charges * gstRate) / 100;
  return (
    <form action={action} className="space-y-3">
      <Field label="Hall" required>
        <Select name="hall_id" value={hallId ?? ""} onChange={(e) => { const h = halls.find((x) => x.id === Number(e.target.value)); setHallId(Number(e.target.value)); if (h) { setCharges(enquiry.quoted_amount ?? h.base_rate); setDeposit(h.deposit_default); } }} required>
          {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </Field>
      <Field label="Event date" required><Input name="date" type="date" defaultValue={enquiry.event_date ?? ""} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" required><Input name="start_time" type="time" defaultValue={enquiry.start_time?.slice(0, 5) ?? "09:00"} required /></Field>
        <Field label="To" required><Input name="end_time" type="time" defaultValue={enquiry.end_time?.slice(0, 5) ?? "14:00"} required /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hall charges (₹)" required><Input name="hall_charges" type="number" min={0} value={charges} onChange={(e) => setCharges(Number(e.target.value))} required /></Field>
        <Field label="Security deposit (₹)"><Input name="deposit_amount" type="number" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></Field>
      </div>
      <p className="text-xs text-muted">GST {gstRate}% = {inr(gst)} · Total with GST {inr(charges + gst)} · plus refundable deposit {inr(deposit)}</p>
      <Field label="Booking status">
        <Select name="status" defaultValue="tentative">
          <option value="tentative">Tentative hold (expires automatically)</option>
          <option value="confirmed">Confirmed (advance received)</option>
        </Select>
      </Field>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create booking"}</Button></div>
    </form>
  );
}
