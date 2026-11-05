"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LABELS, type Booking, type BookingCharge, type Hall, type PaymentDue } from "@/lib/types";
import { inr, splitISO, todayISO } from "@/lib/format";
import { BookingForm } from "../booking-form";
import { addCharge, addDue, addPayment, cancelBooking, deleteCharge, deleteDue, extendHold, rescheduleBooking, setBookingStatus, toggleDue } from "../actions";
import type { ActionState } from "../../enquiries/actions";

function useFormAction(fn: (p: ActionState, fd: FormData) => Promise<ActionState>, onOk: () => void) {
  return useActionState(async (p: ActionState, fd: FormData) => {
    const r = await fn(p, fd);
    if (r?.ok) { onOk(); toast.success("Saved"); }
    return r;
  }, null);
}

export function BookingActions({ booking, halls, gstRate, canAccounts }: { booking: Booking; halls: Hall[]; gstRate: number; canAccounts: boolean }) {
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [resch, setResch] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); if (r?.error) toast.error(r.error); else toast.success("Updated"); });
  const live = booking.status !== "cancelled";

  return (
    <>
      {booking.status === "tentative" && (
        <Button variant="ok" size="sm" disabled={pending} onClick={() => run(() => setBookingStatus(booking.id, "confirmed"))}><CheckCircle2 /> Confirm</Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {live && <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Edit booking</DropdownMenuItem>}
          {live && <DropdownMenuItem onSelect={() => setResch(true)}><CalendarClock /> Reschedule</DropdownMenuItem>}
          {booking.status === "tentative" && <DropdownMenuItem onSelect={() => run(() => extendHold(booking.id, 3))}><Clock /> Extend hold by 3 days</DropdownMenuItem>}
          {booking.status === "confirmed" && canAccounts && <DropdownMenuItem onSelect={() => run(() => setBookingStatus(booking.id, "tentative"))}><Clock /> Revert to tentative</DropdownMenuItem>}
          {live && canAccounts && <><DropdownMenuSeparator /><DropdownMenuItem className="text-danger" onSelect={() => setCancel(true)}><XCircle /> Cancel booking</DropdownMenuItem></>}
          {!live && canAccounts && <DropdownMenuItem onSelect={() => run(() => setBookingStatus(booking.id, "tentative"))}>Restore as tentative</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title={`Edit booking #${booking.booking_no}`} className="max-w-3xl">
          <BookingForm halls={halls} booking={booking} gstRate={gstRate} canDiscount={canAccounts} onDone={() => setEdit(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={cancel} onOpenChange={setCancel}>
        <DialogContent title="Cancel booking" description="The record is kept; the hall slot is released.">
          <CancelForm id={booking.id} onDone={() => setCancel(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={resch} onOpenChange={setResch}>
        <DialogContent title="Reschedule" description="The original slot is remembered in the change history.">
          <RescheduleForm booking={booking} halls={halls} onDone={() => setResch(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CancelForm({ id, onDone }: { id: number; onDone: () => void }) {
  const [state, action, pending] = useFormAction(cancelBooking.bind(null, id), onDone);
  return (
    <form action={action} className="space-y-3">
      <Field label="Reason" required><Textarea name="reason" rows={2} required autoFocus /></Field>
      <Field label="Cancellation charge (₹)" hint="Amount the Mandal retains. Anything paid above this is refundable."><Input name="cancellation_charge" type="number" min={0} defaultValue={0} /></Field>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end"><Button variant="danger" type="submit" disabled={pending}>Cancel booking</Button></div>
    </form>
  );
}

function RescheduleForm({ booking, halls, onDone }: { booking: Booking; halls: Hall[]; onDone: () => void }) {
  const [state, action, pending] = useFormAction(rescheduleBooking.bind(null, booking.id), onDone);
  const s = splitISO(booking.start_at), e = splitISO(booking.end_at);
  return (
    <form action={action} className="space-y-3">
      <Field label="Hall"><Select name="hall_id" defaultValue={booking.hall_id}>{halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select></Field>
      <Field label="New date" required><Input name="date" type="date" defaultValue={s.date} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" required><Input name="start_time" type="time" defaultValue={s.time} required /></Field>
        <Field label="To" required><Input name="end_time" type="time" defaultValue={e.time} required /></Field>
      </div>
      {s.date !== e.date && <Field label="End date"><Input name="end_date" type="date" defaultValue={e.date} /></Field>}
      <Field label="Note"><Input name="note" placeholder="Reason for change" /></Field>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={pending}>Move booking</Button></div>
    </form>
  );
}

export function ChargeActions({ bookingId, charges, canDelete }: { bookingId: number; charges: BookingCharge[]; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(addCharge.bind(null, bookingId), () => setOpen(false));
  return (
    <>
      <div className="flex items-center gap-1">
        {canDelete && charges.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Remove…</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {charges.map((c) => <DropdownMenuItem key={c.id} onSelect={() => deleteCharge(bookingId, c.id)}><Trash2 /> {LABELS.chargeKind[c.kind]} {inr(c.amount)}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus /> Charge</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add charge" description="Overtime, cleaning, equipment, catering royalty…">
          <form action={action} className="space-y-3">
            <Field label="Type"><Select name="kind" defaultValue="overtime">{Object.entries(LABELS.chargeKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Description"><Input name="description" placeholder="e.g. 2 hours overtime" /></Field>
            <Field label="Amount (₹)" required><Input name="amount" type="number" min={0} required autoFocus /></Field>
            {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={pending}>Add charge</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DueActions({ bookingId, canEdit, due }: { bookingId: number; canEdit: boolean; due?: PaymentDue }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(addDue.bind(null, bookingId), () => setOpen(false));
  if (due) {
    return (
      <span className="flex items-center gap-1">
        <input type="checkbox" checked={due.settled} disabled={!canEdit} onChange={(e) => toggleDue(bookingId, due.id, e.target.checked)} aria-label="Settled" />
        {canEdit && <button type="button" className="text-muted hover:text-danger" onClick={() => deleteDue(bookingId, due.id)} aria-label="Remove"><Trash2 className="size-3.5" /></button>}
      </span>
    );
  }
  if (!canEdit) return null;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Plus /> Due date</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add instalment due date">
          <form action={action} className="space-y-3">
            <Field label="Due date" required><Input name="due_date" type="date" required autoFocus /></Field>
            <Field label="Amount (₹)" required><Input name="amount" type="number" min={0} required /></Field>
            <Field label="Note"><Input name="note" placeholder="e.g. Balance before event" /></Field>
            {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={pending}>Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PaymentActions({ bookingId, canEdit, suggestedAmount, depositDue }: { bookingId: number; canEdit: boolean; suggestedAmount: number; depositDue: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("instalment");
  const [state, action, pending] = useFormAction(addPayment.bind(null, bookingId), () => setOpen(false));
  if (!canEdit) return null;
  const amount = kind === "deposit" ? depositDue : kind.includes("refund") ? 0 : suggestedAmount;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus /> Record payment</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Record payment" description="A receipt number is assigned automatically for money received.">
          <form action={action} className="space-y-3">
            <Field label="Type">
              <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(LABELS.paymentKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)" required><Input key={kind} name="amount" type="number" min={1} defaultValue={amount || ""} required autoFocus /></Field>
              <Field label="Date" required><Input name="paid_on" type="date" defaultValue={todayISO()} required /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mode"><Select name="mode" defaultValue="upi">{Object.entries(LABELS.paymentMode).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Cheque no. / UPI ref / bank"><Input name="reference" /></Field>
            </div>
            <Field label="Notes"><Input name="notes" /></Field>
            {kind === "advance" && <p className="text-xs text-muted">Recording an advance confirms a tentative booking automatically.</p>}
            {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={pending}>Save payment</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
