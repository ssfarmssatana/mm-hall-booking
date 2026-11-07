import { getHalls, getSession, getSettings } from "@/lib/data";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { loadReport, fyStart } from "@/lib/report";
import { EnquiryConversionChart, RevenueChart, ShareDonut, HorizontalBars } from "@/components/app/charts";
import { PrintButton } from "../[id]/print-button";
import { AutoPrint } from "./auto-print";

export const metadata = { title: "Hall booking report" };

export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const [halls, s] = await Promise.all([getHalls(), getSettings()]);
  const from = sp.from || fyStart(), to = sp.to || todayISO(), hall = sp.hall || "", basis = sp.basis || "booking_date";
  const r = await loadReport(supabase, halls, from, to, hall, basis);
  const st = r.stats;
  const hallName = hall ? halls.find((h) => h.id === Number(hall))?.name : "All halls";
  const tot = r.monthly.reduce((a, m) => ({ enquiries: a.enquiries + m.enquiries, converted: a.converted + m.converted, lost: a.lost + m.lost, bookings: a.bookings + m.bookings_confirmed, value: a.value + m.confirmed_value, coll: a.coll + m.collections }), { enquiries: 0, converted: 0, lost: 0, bookings: 0, value: 0, coll: 0 });

  const kpi = [
    ["Total enquiries", st.enquiries_total ?? 0], ["Converted", st.enquiries_converted ?? 0], ["Conversion rate", `${st.conversion_pct ?? 0}%`], ["Lost", st.enquiries_lost ?? 0],
    ["Confirmed bookings", st.bookings_confirmed ?? 0], ["Confirmed booking value", inr(st.confirmed_value)], ["Collections", inr(st.collections)], ["Outstanding", inr(st.outstanding)],
  ];

  return (
    <main className="min-h-dvh bg-surface-2 p-4 print:bg-white print:p-0">
      <AutoPrint enabled={sp.auto === "1"} />
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3">
        <p className="text-sm text-muted">Choose “Save as PDF” as the printer to download this report.</p>
        <PrintButton />
      </div>
      <article className="print-page mx-auto max-w-[210mm] bg-white p-8 text-[12px] leading-snug text-black shadow-md print:shadow-none" style={{ fontFamily: "var(--font-sans)" }}>
        <header className="flex items-start justify-between border-b-2 border-[#9a3412] pb-3">
          <div>
            <div className="text-lg font-bold text-[#9a3412]">{String(s.org_name ?? "Maratha Mandal Mulund")}</div>
            <div className="text-sm">{String(s.org_name_mr ?? "")}</div>
            <div className="text-[11px] text-neutral-600">{String(s.org_address ?? "")}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold">Hall Booking Report</div>
            <div className="text-[11px]">{fmtDate(from)} – {fmtDate(to)} · {hallName}</div>
            <div className="text-[11px] text-neutral-600">Basis: {basis === "event_date" ? "event date" : "booking entry date"} · Prepared {fmtDate(todayISO())} by {profile.full_name}</div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-4 gap-2">
          {kpi.map(([l, v], i) => (
            <div key={String(l)} className={`rounded border p-2 ${i === 2 ? "border-[#9a3412] bg-[#fbe9df]" : "border-neutral-200"}`}>
              <div className="text-[10px] text-neutral-600">{l}</div>
              <div className={`num text-base font-semibold ${i === 2 ? "text-[#9a3412]" : ""}`}>{v}</div>
            </div>
          ))}
        </section>

        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-semibold">Enquiries and conversions, month by month</h2>
          <EnquiryConversionChart data={r.monthly} height={230} />
        </section>

        <section className="mt-3 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-semibold">Booking value and collections</h2>
          <RevenueChart data={r.monthly} height={210} />
        </section>

        <section className="mt-4 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-semibold">Monthly summary</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead><tr className="bg-neutral-100">{["Month", "Enquiries", "Converted", "Lost", "Conversion %", "Confirmed bookings", "Booking value", "Collections"].map((h, i) => <th key={h} className={`border border-neutral-300 px-2 py-1 ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>
              {r.monthly.map((m) => (
                <tr key={m.month}><td className="border border-neutral-300 px-2 py-1">{fmtDate(m.month, "MMMM yyyy")}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{m.enquiries}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{m.converted}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{m.lost}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{m.enquiries ? Math.round((m.converted * 1000) / m.enquiries) / 10 : 0}%</td><td className="num border border-neutral-300 px-2 py-1 text-right">{m.bookings_confirmed}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{inr(m.confirmed_value)}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{inr(m.collections)}</td></tr>
              ))}
              <tr className="bg-neutral-100 font-semibold"><td className="border border-neutral-300 px-2 py-1">Total</td><td className="num border border-neutral-300 px-2 py-1 text-right">{tot.enquiries}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{tot.converted}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{tot.lost}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{tot.enquiries ? Math.round((tot.converted * 1000) / tot.enquiries) / 10 : 0}%</td><td className="num border border-neutral-300 px-2 py-1 text-right">{tot.bookings}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{inr(tot.value)}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{inr(tot.coll)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-6 break-inside-avoid">
          <div><h2 className="mb-1 text-[13px] font-semibold">Confirmed bookings by hall</h2><ShareDonut data={r.hallShare.map((h) => ({ name: h.name, value: h.value }))} height={190} /></div>
          <div><h2 className="mb-1 text-[13px] font-semibold">Enquiry sources</h2><ShareDonut data={r.sources.map((x) => ({ name: x.name, value: x.total }))} height={190} /></div>
          <div><h2 className="mb-1 text-[13px] font-semibold">Why enquiries were lost</h2><HorizontalBars data={r.lostReasons} height={170} /></div>
          <div><h2 className="mb-1 text-[13px] font-semibold">Collections by payment mode</h2><ShareDonut data={r.paymentModes} height={190} /></div>
        </section>

        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-semibold">Hall performance</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead><tr className="bg-neutral-100"><th className="border border-neutral-300 px-2 py-1 text-left">Hall</th><th className="border border-neutral-300 px-2 py-1 text-right">Confirmed bookings</th><th className="border border-neutral-300 px-2 py-1 text-right">Booking value</th><th className="border border-neutral-300 px-2 py-1 text-right">Average per booking</th></tr></thead>
            <tbody>{r.hallShare.map((h) => <tr key={h.name}><td className="border border-neutral-300 px-2 py-1">{h.name}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{h.value}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{inr(h.amount)}</td><td className="num border border-neutral-300 px-2 py-1 text-right">{h.value ? inr(h.amount / h.value) : "—"}</td></tr>)}</tbody>
          </table>
        </section>

        <footer className="mt-6 flex justify-between border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
          <span>{String(s.org_name ?? "")} · Hall booking system</span>
          <span>Deposits held {inr(st.deposits_held)} · refund pending {inr(st.deposits_refund_pending)}</span>
        </footer>
      </article>
    </main>
  );
}
