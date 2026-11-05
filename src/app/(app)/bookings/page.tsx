import Link from "next/link";
import { Plus } from "lucide-react";
import { getHalls, getSession } from "@/lib/data";
import { fmtDate, fmtRange, inr } from "@/lib/format";
import type { BookingFinancials } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { SearchBox } from "@/components/app/search-box";

export const metadata = { title: "Bookings" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "tentative", label: "Tentative" },
  { key: "confirmed", label: "Confirmed" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.status || sp.tab || "upcoming";
  const q = sp.q?.trim() || "";
  const { supabase } = await getSession();
  const halls = await getHalls();
  const now = new Date().toISOString();

  let query = supabase.from("bookings").select("*").limit(300);
  if (tab === "upcoming") query = query.in("status", ["confirmed", "tentative", "blocked"]).gte("end_at", now).order("start_at");
  else if (tab === "past") query = query.lt("end_at", now).order("start_at", { ascending: false });
  else if (tab === "all") query = query.order("booking_no", { ascending: false });
  else query = query.eq("status", tab).order("start_at", { ascending: tab !== "cancelled" });
  if (q) query = query.or(`customer_name.ilike.%${q}%,mobile.ilike.%${q}%,programme_type.ilike.%${q}%${/^\d+$/.test(q) ? `,booking_no.eq.${q}` : ""}`);
  const { data: rows } = await query;
  const ids = (rows ?? []).map((r) => r.id);
  const fin = new Map<number, BookingFinancials>();
  if (ids.length) {
    const { data } = await supabase.from("booking_financials").select("*").in("booking_id", ids);
    for (const f of data ?? []) fin.set(f.booking_id, f as BookingFinancials);
  }
  const hallName = (id: number) => halls.find((h) => h.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title="Bookings" subtitle="The booking register.">
        <Button asChild><Link href="/bookings/new"><Plus /> New booking</Link></Button>
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md bg-surface-2 p-1">
          {TABS.map((t) => (
            <Link key={t.key} href={`/bookings?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}>{t.label}</Link>
          ))}
        </div>
        <SearchBox placeholder="Search name, mobile, booking no." />
      </div>
      <div className="rounded-lg border border-line bg-surface">
        <Table>
          <THead><TR><TH>No.</TH><TH>Customer</TH><TH>Event</TH><TH className="hidden md:table-cell">Hall</TH><TH className="num hidden text-right sm:table-cell">Total</TH><TH className="num text-right">Balance</TH><TH>Status</TH></TR></THead>
          <TBody>
            {!rows?.length && <TR><TD colSpan={7} className="py-10 text-center text-muted">No bookings in this view.</TD></TR>}
            {rows?.map((b) => {
              const f = fin.get(b.id);
              return (
                <TR key={b.id}>
                  <TD className="num text-muted">{b.booking_no}<div className="text-[11px]">{fmtDate(b.booking_date, "dd/MM/yy")}</div></TD>
                  <TD><Link href={`/bookings/${b.id}`} className="font-medium hover:text-accent">{b.customer_name}</Link><div className="text-xs text-muted">{b.programme_type || "—"} · {b.mobile}</div></TD>
                  <TD className="text-[13px]">{fmtRange(b.start_at, b.end_at)}</TD>
                  <TD className="hidden md:table-cell">{hallName(b.hall_id)}</TD>
                  <TD className="num hidden text-right sm:table-cell">{inr(f?.total_payable)}</TD>
                  <TD className={`num text-right ${f && f.balance > 0 ? "font-semibold text-danger" : "text-ok"}`}>{f ? (f.balance > 0 ? inr(f.balance) : "Paid") : "—"}</TD>
                  <TD><BookingStatusBadge status={b.status} /></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
