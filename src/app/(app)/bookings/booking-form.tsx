"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PROGRAMME_TYPES, type Booking, type Hall } from "@/lib/types";
import { inr, splitISO, todayISO } from "@/lib/format";
import { createBooking, updateBooking } from "./actions";
import type { ActionState } from "../enquiries/actions";

export function BookingForm({ halls, booking, gstRate, canDiscount, prefill, onDone }: {
  halls: Hall[]; booking?: Booking; gstRate: number; canDiscount: boolean;
  prefill?: Partial<Booking> & { enquiry_id?: number }; onDone?: () => void;
}) {
  const b = booking;
  const src = b ?? prefill;
  const action = b ? updateBooking.bind(null, b.id) : createBooking;
  const [state, formAction, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = await action(p, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);

  const [hallId, setHallId] = useState<number>(src?.hall_id ?? halls[0]?.id);
  const hall = halls.find((h) => h.id === hallId);
  const [charges, setCharges] = useState<number>(src?.hall_charges ?? hall?.base_rate ?? 0);
  const [discount, setDiscount] = useState<number>(src?.member_discount ?? 0);
  const [deposit, setDeposit] = useState<number>(src?.deposit_amount ?? hall?.deposit_default ?? 0);
  const [rate, setRate] = useState<number>(src?.gst_rate ?? gstRate);
  const start = b ? splitISO(b.start_at) : prefill?.start_at ? splitISO(prefill.start_at) : { date: "", time: "09:00" };
  const end = b ? splitISO(b.end_at) : prefill?.end_at ? splitISO(prefill.end_at) : { date: "", time: "14:00" };
  const [startDate, setStartDate] = useState(start.date);
  const [multiDay, setMultiDay] = useState(start.date !== end.date && !!end.date);

  const calc = useMemo(() => {
    const taxable = Math.max(0, charges - discount);
    const gst = Math.round(taxable * rate) / 100;
    return { taxable, gst, total: taxable + gst, half: gst / 2 };
  }, [charges, discount, rate]);

  return (
    <form action={formAction} className="space-y-5">
      {prefill?.enquiry_id && <input type="hidden" name="enquiry_id" value={prefill.enquiry_id} />}
      <section className="rounded-lg border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Customer · आरक्षण करणाऱ्याचे नाव व पत्ता</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><Input name="customer_name" defaultValue={src?.customer_name} required autoFocus={!b} /></Field>
          <Field label="Mobile" required><Input name="mobile" type="tel" defaultValue={src?.mobile} required /></Field>
          <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={src?.address ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={src?.email ?? ""} /></Field>
          <Field label="Member no. (सभासद क्रमांक)" hint="Leave blank for non-members"><Input name="member_no" defaultValue={src?.member_no ?? ""} /></Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Programme · कार्यक्रम</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Programme type">
            <Input name="programme_type" list="programme-types" defaultValue={src?.programme_type ?? ""} />
            <datalist id="programme-types">{PROGRAMME_TYPES.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Hall" required>
            <Select name="hall_id" value={hallId} onChange={(e) => { const h = halls.find((x) => x.id === Number(e.target.value)); setHallId(Number(e.target.value)); if (h && !b) { setCharges(h.base_rate); setDeposit(h.deposit_default); } }} required>
              {halls.map((h) => <option key={h.id} value={h.id}>{h.name}{h.is_ac ? " · AC" : ""}</option>)}
            </Select>
          </Field>
          <Field label="Event date" required><Input name="date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required><Input name="start_time" type="time" defaultValue={start.time} required /></Field>
            <Field label="To" required><Input name="end_time" type="time" defaultValue={end.time} required /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} /> Ends on a different day
          </label>
          {multiDay && <Field label="End date"><Input name="end_date" type="date" defaultValue={end.date || startDate} /></Field>}
          <Field label="Expected guests"><Input name="expected_guests" type="number" min={0} defaultValue={src?.expected_guests ?? ""} /></Field>
          <Field label="Booking date (register entry)"><Input name="booking_date" type="date" defaultValue={b?.booking_date ?? todayISO()} /></Field>
          {!b && (
            <Field label="Status">
              <Select name="status" defaultValue={prefill?.status ?? "tentative"}>
                <option value="tentative">Tentative hold</option>
                <option value="confirmed">Confirmed</option>
                <option value="blocked">Blocked (maintenance / Mandal use)</option>
              </Select>
            </Field>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Charges · रक्कम</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hall charges (₹)" required><Input name="hall_charges" type="number" min={0} value={charges} onChange={(e) => setCharges(Number(e.target.value))} required /></Field>
          <Field label="Member discount (₹) · सभासद सवलत" hint={canDiscount ? undefined : "Only accounts/admin can apply a discount"}>
            <Input name="member_discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} disabled={!canDiscount} />
          </Field>
          <Field label="GST rate (%)"><Input name="gst_rate" type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
          <Field label="Refundable security deposit (₹) · अनामत रक्कम"><Input name="deposit_amount" type="number" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></Field>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-surface-2 p-3 text-sm sm:grid-cols-4">
          <dt className="text-muted">Taxable</dt><dd className="num text-right sm:text-left">{inr(calc.taxable)}</dd>
          <dt className="text-muted">CGST {rate / 2}% + SGST {rate / 2}%</dt><dd className="num text-right sm:text-left">{inr(calc.half, { decimals: true })} + {inr(calc.half, { decimals: true })}</dd>
          <dt className="text-muted">Total with GST</dt><dd className="num text-right font-semibold sm:text-left">{inr(calc.total)}</dd>
          <dt className="text-muted">Deposit (separate)</dt><dd className="num text-right sm:text-left">{inr(deposit)}</dd>
        </dl>
      </section>

      <Field label="Notes"><Textarea name="notes" defaultValue={src?.notes ?? ""} rows={2} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="terms_accepted" defaultChecked={b?.terms_accepted} /> Customer has read and accepted the booking terms</label>

      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : b ? "Save changes" : "Save booking"}</Button>
      </div>
    </form>
  );
}
