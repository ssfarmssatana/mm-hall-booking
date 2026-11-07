import Link from "next/link";
import { getHalls, getSession } from "@/lib/data";
import { inr, fmtDate, fmtRange, todayISO, localISO } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { RangeFilters } from "@/components/app/filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { Plus } from "lucide-react";
import { TrendLine, type MonthRow } from "@/components/app/charts";

export const metadata = { title: "Dashboard" };

function defaultRange() {
  const now = new Date();
  return { from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const d = defaultRange();
  const from = sp.from || d.from, to = sp.to || d.to, hall = sp.hall || "", basis = sp.basis || "booking_date";
  const { supabase, profile } = await getSession();
  const halls = await getHalls();
  const today = todayISO();

  const sixMonthsAgo = localISO(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1));
  const [statsRes, fu, exp, upcoming, dues, trend] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_from: from, p_to: to, p_hall: hall ? Number(hall) : null, p_basis: basis }),
    supabase.from("enquiries").select("id,enquiry_no,customer_name,mobile,next_follow_up,programme_type,event_date").in("status", ["new", "follow_up"]).lte("next_follow_up", today).order("next_follow_up").limit(10),
    supabase.from("bookings").select("id,booking_no,customer_name,tentative_expires_at,start_at").eq("status", "tentative").order("tentative_expires_at").limit(8),
    supabase.from("bookings").select("id,booking_no,customer_name,start_at,end_at,status,programme_type,hall_id").in("status", ["confirmed", "tentative"]).gte("end_at", new Date().toISOString()).order("start_at").limit(8),
    supabase.from("payment_dues").select("id,booking_id,due_date,amount,bookings(booking_no,customer_name)").eq("settled", false).lte("due_date", today).order("due_date").limit(8),
    supabase.rpc("monthly_report", { p_from: sixMonthsAgo, p_to: today, p_hall: hall ? Number(hall) : null }),
  ]);
  const trendRows = ((trend.data ?? []) as MonthRow[]).map((m) => ({ ...m, enquiries: Number(m.enquiries), bookings_confirmed: Number(m.bookings_confirmed) }));
  const s = (statsRes.data ?? {}) as DashboardStats;
  const hallName = (id: number) => halls.find((h) => h.id === id)?.name ?? "";

  const kpis = [
    { label: "Enquiries", value: s.enquiries_total ?? 0, sub: `${s.enquiries_open ?? 0} still open` },
    { label: "Converted", value: s.enquiries_converted ?? 0, sub: `${s.enquiries_lost ?? 0} lost` },
    { label: "Conversion", value: `${s.conversion_pct ?? 0}%`, sub: "converted ÷ enquiries", accent: true },
    { label: "Confirmed booking value", value: inr(s.confirmed_value), sub: `${s.bookings_confirmed ?? 0} confirmed · ${s.bookings_tentative ?? 0} tentative` },
    { label: "Collections", value: inr(s.collections), sub: "payments received in period" },
    { label: "Outstanding", value: inr(s.outstanding), sub: "still payable", warn: Number(s.outstanding) > 0 },
    { label: "Deposits held", value: inr(s.deposits_held), sub: `${inr(s.deposits_refund_pending)} refund pending` },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Namaskar, ${profile.full_name.split(" ")[0]}. ${fmtDate(today, "EEEE, dd MMMM yyyy")}`}>
        <Button asChild variant="secondary"><Link href="/enquiries?new=1"><Plus /> New enquiry</Link></Button>
        <Button asChild><Link href="/bookings/new"><Plus /> New booking</Link></Button>
      </PageHeader>

      <RangeFilters halls={halls} from={from} to={to} hall={hall} basis={basis} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-lg border p-3 ${k.accent ? "border-accent bg-accent-soft/50" : "border-line bg-surface"}`}>
            <div className="text-xs text-ink-2">{k.label}</div>
            <div className={`num mt-1 text-xl font-semibold leading-tight ${k.warn ? "text-danger" : k.accent ? "text-accent" : ""}`}>{k.value}</div>
            <div className="mt-0.5 text-[11px] text-muted">{k.sub}</div>
          </div>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Last 6 months: enquiries vs confirmed bookings</CardTitle><Link href="/reports" className="text-xs text-accent">Full reports</Link></CardHeader>
        <CardContent className="pt-2"><TrendLine data={trendRows} /></CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Follow-ups due</CardTitle><Link href="/enquiries?status=follow_up" className="text-xs text-accent">All enquiries</Link></CardHeader>
          <CardContent className="p-0">
            {!fu.data?.length && <p className="px-4 py-6 text-center text-sm text-muted">No follow-ups pending today.</p>}
            <ul className="divide-y divide-line">
              {fu.data?.map((e) => (
                <li key={e.id}>
                  <Link href={`/enquiries/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.customer_name} <span className="text-muted">· {e.mobile}</span></div>
                      <div className="truncate text-xs text-muted">{e.programme_type || "—"} {e.event_date ? `· event ${fmtDate(e.event_date)}` : ""}</div>
                    </div>
                    <span className={`text-xs font-medium ${e.next_follow_up! < today ? "text-danger" : "text-warn"}`}>{e.next_follow_up! < today ? "Overdue" : "Today"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments overdue</CardTitle><Link href="/payments" className="text-xs text-accent">Payments</Link></CardHeader>
          <CardContent className="p-0">
            {!dues.data?.length && <p className="px-4 py-6 text-center text-sm text-muted">No overdue instalments.</p>}
            <ul className="divide-y divide-line">
              {dues.data?.map((d) => {
                const b = d.bookings as unknown as { booking_no: number; customer_name: string } | null;
                return (
                  <li key={d.id}>
                    <Link href={`/bookings/${d.booking_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{b?.customer_name} <span className="text-muted">· #{b?.booking_no}</span></div>
                        <div className="text-xs text-muted">Due {fmtDate(d.due_date)}</div>
                      </div>
                      <span className="num text-sm font-semibold text-danger">{inr(d.amount)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tentative holds</CardTitle><Link href="/bookings?status=tentative" className="text-xs text-accent">All tentative</Link></CardHeader>
          <CardContent className="p-0">
            {!exp.data?.length && <p className="px-4 py-6 text-center text-sm text-muted">No tentative holds.</p>}
            <ul className="divide-y divide-line">
              {exp.data?.map((b) => {
                const expired = b.tentative_expires_at && new Date(b.tentative_expires_at) < new Date();
                return (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{b.customer_name} <span className="text-muted">· #{b.booking_no}</span></div>
                        <div className="text-xs text-muted">Event {fmtDate(b.start_at)}</div>
                      </div>
                      <span className={`text-xs font-medium ${expired ? "text-danger" : "text-warn"}`}>{expired ? "Expired" : `Expires ${fmtDate(b.tentative_expires_at, "dd MMM, h:mm a")}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upcoming events</CardTitle><Link href="/calendar" className="text-xs text-accent">Calendar</Link></CardHeader>
          <CardContent className="p-0">
            {!upcoming.data?.length && <p className="px-4 py-6 text-center text-sm text-muted">No upcoming events.</p>}
            <ul className="divide-y divide-line">
              {upcoming.data?.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{b.customer_name} <span className="text-muted">· {b.programme_type || "—"}</span></div>
                      <div className="truncate text-xs text-muted">{fmtRange(b.start_at, b.end_at)} · {hallName(b.hall_id)}</div>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
