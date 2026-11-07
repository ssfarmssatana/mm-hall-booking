import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { getHalls, getSession } from "@/lib/data";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { loadReport, fyStart } from "@/lib/report";
import { PageHeader } from "@/components/app/page-header";
import { RangeFilters } from "@/components/app/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EnquiryConversionChart, RevenueChart, ShareDonut, HorizontalBars } from "@/components/app/charts";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await getSession();
  const halls = await getHalls();
  const from = sp.from || fyStart(), to = sp.to || todayISO(), hall = sp.hall || "", basis = sp.basis || "booking_date";
  const r = await loadReport(supabase, halls, from, to, hall, basis);
  const s = r.stats;
  const qs = `from=${from}&to=${to}${hall ? `&hall=${hall}` : ""}&basis=${basis}`;
  const rows = r.monthly;
  const tot = rows.reduce((a, m) => ({ enquiries: a.enquiries + m.enquiries, converted: a.converted + m.converted, lost: a.lost + m.lost, bookings_confirmed: a.bookings_confirmed + m.bookings_confirmed, confirmed_value: a.confirmed_value + m.confirmed_value, collections: a.collections + m.collections, events_held: a.events_held + m.events_held }), { enquiries: 0, converted: 0, lost: 0, bookings_confirmed: 0, confirmed_value: 0, collections: 0, events_held: 0 });

  return (
    <>
      <PageHeader title="Reports" subtitle={`${fmtDate(from)} – ${fmtDate(to)} · ${hall ? halls.find((h) => h.id === Number(hall))?.name : "All halls"}`}>
        <Button asChild variant="secondary" size="sm"><a href={`/print/report?${qs}&auto=1`} target="_blank"><FileText /> PDF report</a></Button>
        <Button asChild size="sm"><a href={`/api/export/xlsx?${qs}`}><FileSpreadsheet /> Excel report</a></Button>
      </PageHeader>
      <RangeFilters halls={halls} from={from} to={to} hall={hall} basis={basis} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total enquiries", s.enquiries_total ?? 0], ["Converted", s.enquiries_converted ?? 0], ["Conversion rate", `${s.conversion_pct ?? 0}%`],
          ["Confirmed booking value", inr(s.confirmed_value)], ["Collections", inr(s.collections)], ["Outstanding", inr(s.outstanding)],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-line bg-surface p-3"><div className="text-xs text-ink-2">{l}</div><div className="num mt-1 text-xl font-semibold">{v}</div></div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Enquiries vs conversions, by month</CardTitle></CardHeader><CardContent><EnquiryConversionChart data={rows} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Booking value vs collections, by month</CardTitle></CardHeader><CardContent><RevenueChart data={rows} /></CardContent></Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle>Confirmed bookings by hall</CardTitle></CardHeader><CardContent><ShareDonut data={r.hallShare.map((h) => ({ name: h.name, value: h.value }))} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Where enquiries come from</CardTitle></CardHeader><CardContent><ShareDonut data={r.sources.map((x) => ({ name: x.name, value: x.total }))} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Why enquiries were lost</CardTitle></CardHeader><CardContent><HorizontalBars data={r.lostReasons} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Collections by payment mode</CardTitle></CardHeader><CardContent><ShareDonut data={r.paymentModes} unit="" /></CardContent></Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Monthly summary</CardTitle><Button asChild variant="ghost" size="sm"><a href={`/api/export?type=enquiries&${qs}`}><Download /> Enquiries CSV</a></Button></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Month</TH><TH className="text-right">Enquiries</TH><TH className="text-right">Converted</TH><TH className="text-right">Lost</TH><TH className="text-right">Conversion %</TH><TH className="text-right">Confirmed bookings</TH><TH className="text-right">Booking value</TH><TH className="text-right">Collections</TH><TH className="text-right">Events held</TH></TR></THead>
            <TBody>
              {rows.map((m) => (
                <TR key={m.month}><TD>{fmtDate(m.month, "MMMM yyyy")}</TD><TD className="num text-right">{m.enquiries}</TD><TD className="num text-right">{m.converted}</TD><TD className="num text-right">{m.lost}</TD><TD className="num text-right font-medium">{m.enquiries ? Math.round((m.converted * 1000) / m.enquiries) / 10 : 0}%</TD><TD className="num text-right">{m.bookings_confirmed}</TD><TD className="num text-right">{inr(m.confirmed_value)}</TD><TD className="num text-right">{inr(m.collections)}</TD><TD className="num text-right">{m.events_held}</TD></TR>
              ))}
              <TR className="bg-surface-2 font-semibold"><TD>Total</TD><TD className="num text-right">{tot.enquiries}</TD><TD className="num text-right">{tot.converted}</TD><TD className="num text-right">{tot.lost}</TD><TD className="num text-right">{tot.enquiries ? Math.round((tot.converted * 1000) / tot.enquiries) / 10 : 0}%</TD><TD className="num text-right">{tot.bookings_confirmed}</TD><TD className="num text-right">{inr(tot.confirmed_value)}</TD><TD className="num text-right">{inr(tot.collections)}</TD><TD className="num text-right">{tot.events_held}</TD></TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Enquiry source performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table><THead><TR><TH>Source</TH><TH className="text-right">Enquiries</TH><TH className="text-right">Booked</TH><TH className="text-right">Conversion</TH></TR></THead>
              <TBody>{r.sources.map((x) => <TR key={x.name}><TD>{x.name}</TD><TD className="num text-right">{x.total}</TD><TD className="num text-right">{x.booked}</TD><TD className="num text-right">{x.total ? Math.round((x.booked * 100) / x.total) : 0}%</TD></TR>)}</TBody></Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Popular programme types (enquiries)</CardTitle></CardHeader>
          <CardContent><HorizontalBars data={r.programmes} color="#0f766e" /></CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">Also available: <a className="text-accent" href={`/api/export?type=bookings&${qs}`}>bookings CSV</a> · <a className="text-accent" href={`/api/export?type=payments&${qs}`}>payments CSV</a>. The Excel report contains all of the above in one workbook.</p>
    </>
  );
}
