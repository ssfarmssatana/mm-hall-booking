import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csv(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n");
}

/** CSV export (opens in Excel). Runs as the logged-in user, so RLS applies. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "bookings";
  const from = url.searchParams.get("from") || "2000-01-01";
  const to = url.searchParams.get("to") || "2100-01-01";
  const hall = url.searchParams.get("hall");

  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];

  if (type === "bookings") {
    let q = supabase.from("bookings").select("*, halls(name)").gte("booking_date", from).lte("booking_date", to).order("booking_no");
    if (hall) q = q.eq("hall_id", Number(hall));
    const { data } = await q;
    const ids = (data ?? []).map((b) => b.id);
    const { data: fin } = ids.length ? await supabase.from("booking_financials").select("*").in("booking_id", ids) : { data: [] };
    const fmap = new Map((fin ?? []).map((f) => [f.booking_id, f]));
    rows = (data ?? []).map((b) => {
      const f = fmap.get(b.id) ?? {};
      return { ...b, hall: (b.halls as { name: string } | null)?.name, ...Object.fromEntries(Object.entries(f).filter(([k]) => k !== "booking_id")) };
    });
    columns = ["booking_no", "booking_date", "status", "customer_name", "mobile", "address", "member_no", "programme_type", "hall", "start_at", "end_at", "expected_guests", "hall_charges", "extra_charges", "member_discount", "taxable_amount", "gst_rate", "gst_amount", "total_payable", "paid", "balance", "deposit_amount", "deposit_received", "deposit_refunded", "cancellation_reason", "cancellation_charge", "notes"];
  } else if (type === "payments") {
    let q = supabase.from("payments").select("*, bookings!inner(booking_no, customer_name, hall_id)").gte("paid_on", from).lte("paid_on", to).order("paid_on").order("id");
    if (hall) q = q.eq("bookings.hall_id", Number(hall));
    const { data } = await q;
    rows = (data ?? []).map((p) => ({ ...p, booking_no: (p.bookings as { booking_no: number }).booking_no, customer_name: (p.bookings as { customer_name: string }).customer_name }));
    columns = ["receipt_no", "paid_on", "booking_no", "customer_name", "kind", "amount", "mode", "reference", "notes"];
  } else if (type === "enquiries") {
    let q = supabase.from("enquiries").select("*, halls(name)").gte("created_at", from).lte("created_at", to + "T23:59:59").order("enquiry_no");
    if (hall) q = q.eq("preferred_hall_id", Number(hall));
    const { data } = await q;
    rows = (data ?? []).map((e) => ({ ...e, preferred_hall: (e.halls as { name: string } | null)?.name }));
    columns = ["enquiry_no", "created_at", "customer_name", "mobile", "email", "programme_type", "preferred_hall", "event_date", "expected_guests", "quoted_amount", "source", "status", "lost_reason", "next_follow_up", "converted_booking_id", "notes"];
  } else {
    return new NextResponse("Unknown export type", { status: 400 });
  }

  return new NextResponse(csv(rows, columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}_${from}_to_${to}.csv"`,
    },
  });
}
