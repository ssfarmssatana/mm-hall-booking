import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats, Hall } from "@/lib/types";
import type { MonthRow } from "@/components/app/charts";

export interface ReportData {
  from: string; to: string; hall: string; basis: string;
  stats: DashboardStats;
  monthly: MonthRow[];
  lostReasons: { name: string; value: number }[];
  sources: { name: string; total: number; booked: number }[];
  programmes: { name: string; value: number }[];
  hallShare: { name: string; value: number; amount: number }[];
  paymentModes: { name: string; value: number }[];
}

const SOURCE: Record<string, string> = { phone: "Phone", walk_in: "Walk-in", whatsapp: "WhatsApp", website: "Website", referral: "Referral", other: "Other" };
const MODE: Record<string, string> = { cash: "Cash", cheque: "Cheque", upi: "UPI", bank_transfer: "Bank transfer", card: "Card" };

/** One loader used by the Reports screen, the PDF page and the Excel export so all three agree. */
export async function loadReport(supabase: SupabaseClient, halls: Hall[], from: string, to: string, hall: string, basis: string): Promise<ReportData> {
  const hallNum = hall ? Number(hall) : null;
  const dateCol = basis === "event_date" ? "start_at" : "booking_date";
  const toBound = basis === "event_date" ? to + "T23:59:59" : to;

  const [stats, monthly, lost, enq, bk, pay] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_from: from, p_to: to, p_hall: hallNum, p_basis: basis }),
    supabase.rpc("monthly_report", { p_from: from, p_to: to, p_hall: hallNum }),
    supabase.from("enquiries").select("lost_reason").eq("status", "lost").gte("created_at", from).lte("created_at", to + "T23:59:59"),
    supabase.from("enquiries").select("source,status,programme_type").gte("created_at", from).lte("created_at", to + "T23:59:59"),
    supabase.from("bookings").select("id,hall_id").eq("status", "confirmed").gte(dateCol, from).lte(dateCol, toBound),
    supabase.from("payments").select("mode,amount,kind").in("kind", ["advance", "instalment"]).gte("paid_on", from).lte("paid_on", to),
  ]);

  const count = (rows: { k: string }[]) => { const m = new Map<string, number>(); for (const r of rows) m.set(r.k, (m.get(r.k) ?? 0) + 1); return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); };

  const lostReasons = count((lost.data ?? []).map((r) => ({ k: r.lost_reason || "Other" })));
  const srcMap = new Map<string, { total: number; booked: number }>();
  for (const e of enq.data ?? []) { const s = srcMap.get(e.source) ?? { total: 0, booked: 0 }; s.total++; if (e.status === "booked") s.booked++; srcMap.set(e.source, s); }
  const sources = [...srcMap].map(([k, v]) => ({ name: SOURCE[k] ?? k, ...v })).sort((a, b) => b.total - a.total);
  const programmes = count((enq.data ?? []).map((r) => ({ k: r.programme_type || "Not specified" }))).slice(0, 8);

  const ids = (bk.data ?? []).map((b) => b.id);
  const amounts = new Map<number, number>();
  if (ids.length) {
    const { data: fin } = await supabase.from("booking_financials").select("booking_id,total_payable").in("booking_id", ids);
    for (const f of fin ?? []) amounts.set(f.booking_id, Number(f.total_payable));
  }
  const hallShare = halls.map((h) => {
    const mine = (bk.data ?? []).filter((b) => b.hall_id === h.id);
    return { name: h.name, value: mine.length, amount: mine.reduce((s, b) => s + (amounts.get(b.id) ?? 0), 0) };
  });

  const modeMap = new Map<string, number>();
  for (const p of pay.data ?? []) modeMap.set(p.mode, (modeMap.get(p.mode) ?? 0) + Number(p.amount));
  const paymentModes = [...modeMap].map(([k, v]) => ({ name: MODE[k] ?? k, value: v })).sort((a, b) => b.value - a.value);

  return {
    from, to, hall, basis,
    stats: (stats.data ?? {}) as DashboardStats,
    monthly: ((monthly.data ?? []) as MonthRow[]).map((m) => ({ ...m, enquiries: Number(m.enquiries), converted: Number(m.converted), lost: Number(m.lost), bookings_confirmed: Number(m.bookings_confirmed), bookings_cancelled: Number(m.bookings_cancelled), confirmed_value: Number(m.confirmed_value), collections: Number(m.collections), events_held: Number(m.events_held) })),
    lostReasons, sources, programmes, hallShare, paymentModes,
  };
}

export function fyStart() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
}
