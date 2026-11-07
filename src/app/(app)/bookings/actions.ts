"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, can } from "@/lib/data";
import { toISO, todayISO } from "@/lib/format";
import { friendlyDbError } from "@/lib/errors";
import type { ActionState } from "../enquiries/actions";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
const opt = (v: FormDataEntryValue | null) => (str(v) === "" ? null : str(v));
const n = (v: FormDataEntryValue | null) => Number(str(v) || 0);

function revalidateAll(id?: number) {
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  if (id) revalidatePath(`/bookings/${id}`);
}

function parseBooking(fd: FormData) {
  const date = str(fd.get("date")), start = str(fd.get("start_time")), end = str(fd.get("end_time"));
  const endDate = str(fd.get("end_date")) || date;
  if (!str(fd.get("customer_name"))) return { error: "Customer name is required." };
  if (str(fd.get("mobile")).replace(/\D/g, "").length < 10) return { error: "Mobile number must have 10 digits." };
  if (!date || !start || !end) return { error: "Event date, start and end time are required." };
  const start_at = toISO(date, start), end_at = toISO(endDate, end);
  if (end_at <= start_at) return { error: "End time must be after start time." };
  return {
    data: {
      hall_id: n(fd.get("hall_id")),
      customer_name: str(fd.get("customer_name")),
      mobile: str(fd.get("mobile")).replace(/\s+/g, ""),
      email: opt(fd.get("email")),
      address: opt(fd.get("address")),
      member_no: opt(fd.get("member_no")),
      programme_type: opt(fd.get("programme_type")),
      expected_guests: opt(fd.get("expected_guests")) ? n(fd.get("expected_guests")) : null,
      start_at, end_at,
      booking_date: str(fd.get("booking_date")) || todayISO(),
      hall_charges: n(fd.get("hall_charges")),
      member_discount: n(fd.get("member_discount")),
      gst_rate: n(fd.get("gst_rate")),
      deposit_amount: n(fd.get("deposit_amount")),
      notes: opt(fd.get("notes")),
      status: (str(fd.get("status")) || "tentative") as "tentative" | "confirmed" | "blocked",
      terms_accepted: fd.get("terms_accepted") === "on",
    },
  };
}

export async function createBooking(_p: ActionState, fd: FormData): Promise<ActionState> {
  const p = parseBooking(fd);
  if ("error" in p) return { error: p.error };
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("bookings").insert(p.data).select("id").single();
  if (error) return { error: friendlyDbError(error.message) };
  const enquiryId = opt(fd.get("enquiry_id"));
  if (enquiryId) await supabase.from("enquiries").update({ status: "booked", converted_booking_id: data.id }).eq("id", Number(enquiryId));
  revalidateAll(data.id);
  redirect(`/bookings/${data.id}`);
}

export async function updateBooking(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const p = parseBooking(fd);
  if ("error" in p) return { error: p.error };
  const { supabase } = await getSession();
  const { status: _s, ...rest } = p.data; // status changes go through dedicated actions
  void _s;
  const { error } = await supabase.from("bookings").update(rest).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function setBookingStatus(id: number, status: "confirmed" | "tentative" | "blocked"): Promise<ActionState> {
  const { supabase } = await getSession();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function extendHold(id: number, days: number): Promise<ActionState> {
  const { supabase } = await getSession();
  const { error } = await supabase.from("bookings").update({ tentative_expires_at: new Date(Date.now() + days * 86400e3).toISOString() }).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function cancelBooking(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await getSession();
  if (!can(profile, "accounts")) return { error: "Only accounts/admin can cancel a booking." };
  const reason = str(fd.get("reason"));
  if (!reason) return { error: "Give a reason for cancellation." };
  const { error } = await supabase.from("bookings").update({ status: "cancelled", cancellation_reason: reason, cancellation_charge: n(fd.get("cancellation_charge")) }).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function rescheduleBooking(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const date = str(fd.get("date")), start = str(fd.get("start_time")), end = str(fd.get("end_time"));
  const endDate = str(fd.get("end_date")) || date;
  if (!date || !start || !end) return { error: "New date and times are required." };
  const start_at = toISO(date, start), end_at = toISO(endDate, end);
  if (end_at <= start_at) return { error: "End time must be after start time." };
  const { supabase } = await getSession();
  const patch: Record<string, unknown> = { start_at, end_at };
  const hall = opt(fd.get("hall_id"));
  if (hall) patch.hall_id = Number(hall);
  const note = opt(fd.get("note"));
  if (note) {
    const { data: b } = await supabase.from("bookings").select("notes").eq("id", id).single();
    patch.notes = `${b?.notes ? b.notes + "\n" : ""}Rescheduled ${new Date().toLocaleDateString("en-IN")}: ${note}`;
  }
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function addCharge(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const amount = n(fd.get("amount"));
  if (!amount) return { error: "Enter an amount." };
  const { supabase } = await getSession();
  const { error } = await supabase.from("booking_charges").insert({ booking_id: id, kind: str(fd.get("kind")) || "other", description: opt(fd.get("description")), amount });
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function deleteCharge(bookingId: number, chargeId: number) {
  const { supabase } = await getSession();
  await supabase.from("booking_charges").delete().eq("id", chargeId);
  revalidateAll(bookingId);
}

export async function addPayment(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const amount = n(fd.get("amount"));
  if (!amount || amount <= 0) return { error: "Enter the amount received." };
  const { supabase, profile } = await getSession();
  if (!can(profile, "accounts")) return { error: "Only accounts/admin can record payments." };
  const { error } = await supabase.from("payments").insert({
    booking_id: id,
    kind: str(fd.get("kind")) || "instalment",
    amount,
    mode: str(fd.get("mode")) || "cash",
    reference: opt(fd.get("reference")),
    paid_on: str(fd.get("paid_on")) || todayISO(),
    notes: opt(fd.get("notes")),
  });
  if (error) return { error: friendlyDbError(error.message) };
  // Settle dues covered by this payment (oldest first)
  const kind = str(fd.get("kind"));
  if (kind === "advance" || kind === "instalment") {
    const { data: dues } = await supabase.from("payment_dues").select("id,amount").eq("booking_id", id).eq("settled", false).order("due_date");
    let left = amount;
    for (const d of dues ?? []) {
      if (left >= Number(d.amount)) { await supabase.from("payment_dues").update({ settled: true }).eq("id", d.id); left -= Number(d.amount); }
      else break;
    }
    // Auto-confirm a tentative booking when an advance is received
    if (kind === "advance") {
      const { data: b } = await supabase.from("bookings").select("status").eq("id", id).single();
      if (b?.status === "tentative") await supabase.from("bookings").update({ status: "confirmed" }).eq("id", id);
    }
  }
  revalidateAll(id);
  return { ok: true };
}

export async function addDue(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const amount = n(fd.get("amount"));
  const due_date = str(fd.get("due_date"));
  if (!amount || !due_date) return { error: "Amount and due date are required." };
  const { supabase } = await getSession();
  const { error } = await supabase.from("payment_dues").insert({ booking_id: id, amount, due_date, note: opt(fd.get("note")) });
  if (error) return { error: friendlyDbError(error.message) };
  revalidateAll(id);
  return { ok: true };
}

export async function toggleDue(bookingId: number, dueId: number, settled: boolean) {
  const { supabase } = await getSession();
  await supabase.from("payment_dues").update({ settled }).eq("id", dueId);
  revalidateAll(bookingId);
}

export async function deleteDue(bookingId: number, dueId: number) {
  const { supabase } = await getSession();
  await supabase.from("payment_dues").delete().eq("id", dueId);
  revalidateAll(bookingId);
}
