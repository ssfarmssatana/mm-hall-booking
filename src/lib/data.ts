import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Hall, Profile, Settings } from "@/lib/types";
import { todayISO } from "@/lib/format";

/** Current user + profile, cached per request. Redirects to /login if missing. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return { supabase, user, profile: profile as Profile };
});

export const getHalls = cache(async (includeInactive = false) => {
  const { supabase } = await getSession();
  let q = supabase.from("halls").select("*").order("sort_order").order("id");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Hall[];
});

export const getSettings = cache(async (): Promise<Settings> => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("settings").select("key,value");
  const out: Settings = {};
  for (const row of data ?? []) out[row.key] = row.value as string | number;
  return out;
});

export const getProfiles = cache(async () => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return (data ?? []) as Profile[];
});

export function can(profile: Profile, action: "accounts" | "admin") {
  if (action === "admin") return profile.role === "admin";
  return profile.role === "admin" || profile.role === "accounts";
}

export interface Notification {
  kind: "followup" | "due" | "expiry" | "balance";
  level: "warn" | "danger" | "info";
  title: string;
  detail: string;
  href: string;
}

/** In-app notifications – computed live, nothing stored, nothing sent. */
export const getNotifications = cache(async (): Promise<Notification[]> => {
  const { supabase } = await getSession();
  const today = todayISO();
  const in24h = new Date(Date.now() + 24 * 3600e3).toISOString();
  const in7d = new Date(Date.now() + 7 * 86400e3).toISOString();

  const [fu, dues, exp, upcoming] = await Promise.all([
    supabase.from("enquiries").select("id,enquiry_no,customer_name,next_follow_up").in("status", ["new", "follow_up"]).lte("next_follow_up", today).order("next_follow_up"),
    supabase.from("payment_dues").select("id,booking_id,due_date,amount,bookings(booking_no,customer_name)").eq("settled", false).lte("due_date", today).order("due_date"),
    supabase.from("bookings").select("id,booking_no,customer_name,tentative_expires_at").eq("status", "tentative").lte("tentative_expires_at", in24h).order("tentative_expires_at"),
    supabase.from("bookings").select("id,booking_no,customer_name,start_at").eq("status", "confirmed").gte("start_at", new Date().toISOString()).lte("start_at", in7d),
  ]);
  const upcomingIds = (upcoming.data ?? []).map((b) => b.id);
  const balances = new Map<number, number>();
  if (upcomingIds.length) {
    const { data: fin } = await supabase.from("booking_financials").select("booking_id,balance").in("booking_id", upcomingIds);
    for (const f of fin ?? []) balances.set(f.booking_id, Number(f.balance));
  }

  const out: Notification[] = [];
  for (const e of fu.data ?? []) {
    const overdue = e.next_follow_up! < today;
    out.push({ kind: "followup", level: overdue ? "danger" : "warn", title: `${overdue ? "Overdue" : "Today"}: follow up ${e.customer_name}`, detail: `Enquiry #${e.enquiry_no} · due ${e.next_follow_up}`, href: `/enquiries/${e.id}` });
  }
  for (const d of dues.data ?? []) {
    const b = d.bookings as unknown as { booking_no: number; customer_name: string } | null;
    out.push({ kind: "due", level: "danger", title: `Payment overdue: ${b?.customer_name ?? ""}`, detail: `Booking #${b?.booking_no} · ₹${Number(d.amount).toLocaleString("en-IN")} was due ${d.due_date}`, href: `/bookings/${d.booking_id}` });
  }
  for (const b of exp.data ?? []) {
    const expired = new Date(b.tentative_expires_at!) < new Date();
    out.push({ kind: "expiry", level: expired ? "danger" : "warn", title: `${expired ? "Hold expired" : "Hold expiring"}: ${b.customer_name}`, detail: `Booking #${b.booking_no} · confirm or release`, href: `/bookings/${b.id}` });
  }
  for (const b of upcoming.data ?? []) {
    const bal = balances.get(b.id) ?? 0;
    if (bal > 0) {
      out.push({ kind: "balance", level: "info", title: `Balance pending before event: ${b.customer_name}`, detail: `Booking #${b.booking_no} · ₹${Number(bal).toLocaleString("en-IN")} outstanding`, href: `/bookings/${b.id}` });
    }
  }
  return out;
});
