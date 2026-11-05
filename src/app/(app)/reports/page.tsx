import { Download } from "lucide-react";
import { getHalls, getSession } from "@/lib/data";
import { fmtDate, inr, todayISO } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { RangeFilters } from "@/components/app/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await getSession();
  const halls = await getHalls();
  const now = new Date();
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1).toISOString().slice(0, 10);
  const from = sp.from || fyStart, to = sp.to || todayISO(), hall = sp.hall || "", basis = sp.basis || "booking_date";
  const hallNum = hall ? Number(hall) : null;

  const [{ data: stats }, { data: monthly }, { data: lost }, { data: sources }, { data: hallwise }] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_from: from, p_to: to, p_hall: hallNum, p_basis: basis }),
    supabase.rpc("monthly_conversion", { p_from: from, p_to: to, p_hall: hallNum }),
    supabase.from("enquiries").select("lost_reason").eq("status", "lost").gte("created_at", from).lte("created_at", to + "T23:59:59"),
    supabase.from("enquiries").select("source,status").gte("created_at", from).lte("created_at", to + "T23:59:59"),
    supabase.from("bookings").select("hall_id,status").in("status", ["confirmed"]).gte(basis === "event_date" ? "start_at" : "booking_date", from).lte(basis === "event_date" ? "start_at" : "booking_date", basis === "event_date" ? to + "T23:59:59" : to),
  ]);
  const s = (stats ?? {}) as DashboardStats;
  const lostCount: Record<string, number> = {};
  for (const l of lost ?? []) lostCount[l.lost_reason ?? "Other"] = (lostCount[l.lost_reason ?? "Other"] ?? 0) + 1;
  const srcCount: Record<string, { total: number; booked: number }> = {};
  for (const e of sources ?? []) { const r = (srcCount[e.source] ??= { total: 0, booked: 0 }); r.total++; if (e.status === "booked") r.booked++; }
  const hallCount: Record<number, number> = {};
  for (const b of hallwise ?? []) hallCount[b.hall_id] = (hallCount[b.hall_id] ?? 0) + 1;
  const qs = `from=${from}&to=${to}${hall ? `&hall=${hall}` : ""}`;

  type M = { month: string; total_enquiries: number; confirmed: number; booked_elsewhere: number; lost_other: number; pending: number; conversion_pct: number };
  const rows = (monthly ?? []) as M[];
  const tot = rows.reduce((a, r) => ({ total_enquiries: a.total_enquiries + Number(r.total_enquiries), confirmed: a.confirmed + Number(r.confirmed), booked_elsewhere: a.booked_elsewhere + Number(r.booked_elsewhere), lost_other: a.lost_other + Number(r.lost_other), pending: a.pending + Number(r.pending) }), { total_enquiries: 0, confirmed: 0, booked_elsewhere: 0, lost_other: 0, pending: 0 });

  return (
    <>
      <PageHeader title="Reports" subtitle={`As on ${fmtDate(to)} · ${fmtDate(from)} to ${fmtDate(to)}`}>
        <Button asChild variant="secondary" size="sm"><a href={`/api/export?type=enquiries&${qs}`}><Download /> Enquiries CSV</a></Button>
        <Button asChild variant="secondary" size="sm"><a href={`/api/export?type=bookings&${qs}`}><Download /> Bookings CSV</a></Button>
        <Button asChild variant="secondary" size="sm"><a href={`/api/export?type=payments&${qs}`}><Download /> Payments CSV</a></Button>
      </PageHeader>
      <RangeFilters halls={halls} from={from} to={to} hall={hall} basis={basis} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total enquiries", s.enquiries_total], ["Converted", s.enquiries_converted], ["Conversion %", `${s.conversion_pct ?? 0}%`],
          ["Confirmed booking value", inr(s.confirmed_value)], ["Collections", inr(s.collections)], ["Outstanding", inr(s.outstanding)],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-line bg-surface p-3"><div className="text-xs text-ink-2">{l}</div><div className="num mt-1 text-xl font-semibold">{v ?? 0}</div></div>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Monthly enquiry & conversion summary</CardTitle><span className="text-xs text-muted">By enquiry date</span></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Month</TH><TH className="text-right">Total enquiries</TH><TH className="text-right">Confirmed bookings</TH><TH className="text-right">Booked elsewhere</TH><TH className="text-right">No response / lost</TH><TH className="text-right">Pending</TH><TH className="text-right">Conversion %</TH></TR></THead>
            <TBody>
              {!rows.length && <TR><TD colSpan={7} className="py-8 text-center text-muted">No enquiries in this period.</TD></TR>}
              {rows.map((r) => (
                <TR key={r.month}><TD>{fmtDate(r.month, "MMMM yyyy")}</TD><TD className="num text-right">{r.total_enquiries}</TD><TD className="num text-right">{r.confirmed}</TD><TD className="num text-right">{r.booked_elsewhere}</TD><TD className="num text-right">{r.lost_other}</TD><TD className="num text-right">{r.pending}</TD><TD className="num text-right font-medium">{r.conversion_pct}%</TD></TR>
              ))}
              {rows.length > 0 && (
                <TR className="bg-surface-2 font-semibold"><TD>Total</TD><TD className="num text-right">{tot.total_enquiries}</TD><TD className="num text-right">{tot.confirmed}</TD><TD className="num text-right">{tot.booked_elsewhere}</TD><TD className="num text-right">{tot.lost_other}</TD><TD className="num text-right">{tot.pending}</TD><TD className="num text-right">{tot.total_enquiries ? ((tot.confirmed * 100) / tot.total_enquiries).toFixed(1) : 0}%</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Why enquiries were lost</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!Object.keys(lostCount).length && <p className="px-4 py-6 text-center text-sm text-muted">No lost enquiries.</p>}
            <ul className="divide-y divide-line text-sm">{Object.entries(lostCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between px-4 py-2"><span>{k}</span><span className="num font-medium">{v}</span></li>)}</ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Enquiry source</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line text-sm">{Object.entries(srcCount).map(([k, v]) => <li key={k} className="flex justify-between px-4 py-2"><span className="capitalize">{k.replace("_", "-")}</span><span className="num">{v.booked}/{v.total} booked</span></li>)}</ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Confirmed bookings by hall</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line text-sm">{halls.map((h) => <li key={h.id} className="flex justify-between px-4 py-2"><span>{h.name}</span><span className="num font-medium">{hallCount[h.id] ?? 0}</span></li>)}</ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
