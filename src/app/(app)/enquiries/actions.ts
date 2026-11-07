"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/data";
import { toISO, todayISO } from "@/lib/format";
import { friendlyDbError } from "@/lib/errors";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
const opt = (v: FormDataEntryValue | null) => (str(v) === "" ? null : str(v));
const numOpt = (v: FormDataEntryValue | null) => (str(v) === "" ? null : Number(str(v)));

const enquirySchema = z.object({
  customer_name: z.string().min(2, "Customer name is required"),
  mobile: z.string().min(10, "Mobile number must have 10 digits").max(15),
  email: z.string().email().nullable().or(z.literal(null)),
  address: z.string().nullable(),
  preferred_hall_id: z.number().nullable(),
  event_date: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  programme_type: z.string().nullable(),
  expected_guests: z.number().nullable(),
  quoted_amount: z.number().nullable(),
  source: z.enum(["phone", "walk_in", "whatsapp", "website", "referral", "other"]),
  next_follow_up: z.string().nullable(),
  notes: z.string().nullable(),
  assigned_to: z.string().nullable(),
});

function parseEnquiry(fd: FormData) {
  return enquirySchema.safeParse({
    customer_name: str(fd.get("customer_name")),
    mobile: str(fd.get("mobile")).replace(/\s+/g, ""),
    email: opt(fd.get("email")),
    address: opt(fd.get("address")),
    preferred_hall_id: numOpt(fd.get("preferred_hall_id")),
    event_date: opt(fd.get("event_date")),
    start_time: opt(fd.get("start_time")),
    end_time: opt(fd.get("end_time")),
    programme_type: opt(fd.get("programme_type")),
    expected_guests: numOpt(fd.get("expected_guests")),
    quoted_amount: numOpt(fd.get("quoted_amount")),
    source: str(fd.get("source")) || "phone",
    next_follow_up: opt(fd.get("next_follow_up")),
    notes: opt(fd.get("notes")),
    assigned_to: opt(fd.get("assigned_to")),
  });
}

export type ActionState = { error?: string; ok?: boolean } | null;

export async function createEnquiry(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseEnquiry(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await getSession();
  const { data, error } = await supabase
    .from("enquiries")
    .insert({ ...parsed.data, assigned_to: parsed.data.assigned_to ?? user.id, status: parsed.data.next_follow_up ? "follow_up" : "new" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/enquiries");
  redirect(`/enquiries/${data.id}`);
}

export async function updateEnquiry(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseEnquiry(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await getSession();
  const { error } = await supabase.from("enquiries").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/enquiries");
  return { ok: true };
}

export async function addFollowup(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const note = str(fd.get("note"));
  const outcome = str(fd.get("outcome")) as "new" | "follow_up" | "lost";
  const next = opt(fd.get("next_follow_up"));
  const lost_reason = opt(fd.get("lost_reason"));
  if (!note) return { error: "Write a short note about the call." };
  const { supabase } = await getSession();
  const { error: e1 } = await supabase.from("enquiry_followups").insert({ enquiry_id: id, note, outcome: outcome || null, next_follow_up: next });
  if (e1) return { error: e1.message };
  const patch: Record<string, unknown> = {};
  if (outcome === "lost") { patch.status = "lost"; patch.lost_reason = lost_reason || "Other"; patch.next_follow_up = null; }
  else { patch.status = "follow_up"; patch.next_follow_up = next; }
  const { error: e2 } = await supabase.from("enquiries").update(patch).eq("id", id);
  if (e2) return { error: e2.message };
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/enquiries");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reopenEnquiry(id: number) {
  const { supabase } = await getSession();
  await supabase.from("enquiries").update({ status: "follow_up", lost_reason: null, next_follow_up: todayISO() }).eq("id", id);
  revalidatePath(`/enquiries/${id}`);
  revalidatePath("/enquiries");
}

export async function convertEnquiry(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const hall = Number(fd.get("hall_id"));
  const date = str(fd.get("date")), start = str(fd.get("start_time")), end = str(fd.get("end_time"));
  const charges = Number(fd.get("hall_charges") || 0), deposit = Number(fd.get("deposit_amount") || 0);
  const status = str(fd.get("status")) === "confirmed" ? "confirmed" : "tentative";
  if (!hall || !date || !start || !end) return { error: "Hall, date, start and end time are required." };
  const startAt = toISO(date, start), endAt = toISO(date, end);
  if (endAt <= startAt) return { error: "End time must be after start time." };
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("convert_enquiry", {
    p_enquiry_id: id, p_hall_id: hall, p_start_at: startAt, p_end_at: endAt, p_hall_charges: charges, p_deposit: deposit, p_status: status,
  });
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath("/enquiries");
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  redirect(`/bookings/${data}`);
}
