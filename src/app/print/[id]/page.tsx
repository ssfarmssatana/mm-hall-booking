import { notFound } from "next/navigation";
import { getHalls, getSession, getSettings } from "@/lib/data";
import { amountInWords, fmtDate, fmtRange, inr } from "@/lib/format";
import { LABELS, type Booking, type BookingCharge, type BookingFinancials, type Payment } from "@/lib/types";
import { PrintButton } from "./print-button";

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string; payment?: string }> }) {
  const { id } = await params;
  const { doc = "confirmation", payment } = await searchParams;
  const bid = Number(id);
  const { supabase } = await getSession();
  const [{ data: b }, { data: f }, { data: charges }, { data: payments }, halls, s] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bid).single(),
    supabase.from("booking_financials").select("*").eq("booking_id", bid).single(),
    supabase.from("booking_charges").select("*").eq("booking_id", bid).order("id"),
    supabase.from("payments").select("*").eq("booking_id", bid).order("paid_on").order("id"),
    getHalls(true), getSettings(),
  ]);
  if (!b || !f) notFound();
  const booking = b as Booking, fin = f as BookingFinancials;
  const hall = halls.find((h) => h.id === booking.hall_id);
  const pay = payment ? (payments as Payment[] | null)?.find((p) => p.id === Number(payment)) : null;
  if (doc === "receipt" && !pay) notFound();

  const title = doc === "receipt" ? { en: "RECEIPT", mr: "पावती" } : doc === "quotation" ? { en: "QUOTATION", mr: "दरपत्रक" } : { en: "BOOKING CONFIRMATION", mr: "आरक्षण निश्चिती" };
  const half = booking.gst_rate / 2;

  return (
    <main className="min-h-dvh bg-surface-2 p-4 print:p-0">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] justify-end"><PrintButton /></div>
      <article className="print-page mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-snug text-black shadow-md print:shadow-none" style={{ fontFamily: "var(--font-sans)" }}>
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <div className="text-xl font-bold">{String(s.org_name_mr ?? "")}</div>
            <div className="text-lg font-semibold">{String(s.org_name ?? "")}</div>
            <div className="text-xs">{String(s.org_address ?? "")}</div>
            <div className="text-xs">{[s.org_phone, s.org_email].filter(Boolean).join(" · ")}</div>
            {s.gstin ? <div className="text-xs">GSTIN: {String(s.gstin)}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-base font-bold tracking-wide">{title.en}</div>
            <div className="text-sm">{title.mr}</div>
            <div className="mt-2 text-xs">
              {doc === "receipt" ? <>Receipt No. <b>{pay!.receipt_no}</b><br />Date: {fmtDate(pay!.paid_on)}</> : <>Booking No. <b>{booking.booking_no}</b><br />Date: {fmtDate(doc === "quotation" ? new Date() : booking.booking_date)}</>}
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <Row k="Name / नाव" v={booking.customer_name} />
          <Row k="Mobile / मोबाईल" v={booking.mobile} />
          <Row k="Address / पत्ता" v={booking.address || "—"} span />
          <Row k="Programme / कार्यक्रम" v={booking.programme_type || "—"} />
          <Row k="Member No. / सभासद क्र." v={booking.member_no || "—"} />
          <Row k="Hall / सभागृह" v={`${hall?.name ?? ""}${hall?.name_mr ? ` (${hall.name_mr})` : ""}`} />
          <Row k="Guests / अंदाजे उपस्थिती" v={booking.expected_guests ?? "—"} />
          <Row k="Date & time / दिनांक व वेळ" v={fmtRange(booking.start_at, booking.end_at)} span />
        </section>

        {doc === "receipt" ? (
          <section className="mt-5">
            <table className="w-full border-collapse">
              <tbody>
                <tr><td className="border border-black p-2">Received with thanks / सप्रेम पावले</td><td className="num border border-black p-2 text-right font-bold">{inr(pay!.amount)}</td></tr>
                <tr><td className="border border-black p-2">In words / अक्षरी</td><td className="border border-black p-2">{amountInWords(Number(pay!.amount))}</td></tr>
                <tr><td className="border border-black p-2">Towards / साठी</td><td className="border border-black p-2">{LABELS.paymentKind[pay!.kind]} for booking #{booking.booking_no}</td></tr>
                <tr><td className="border border-black p-2">Mode / प्रकार</td><td className="border border-black p-2">{LABELS.paymentMode[pay!.mode]}{pay!.reference ? ` – ${pay!.reference}` : ""}</td></tr>
                <tr><td className="border border-black p-2">Balance after this receipt / शिल्लक</td><td className="num border border-black p-2 text-right">{inr(fin.balance)}{fin.deposit_held > 0 ? ` (deposit held ${inr(fin.deposit_held)})` : ""}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs">{pay!.mode === "cheque" ? "Subject to realisation of cheque. / धनादेश वटल्यावरच पावती ग्राह्य." : ""}</p>
          </section>
        ) : (
          <section className="mt-5">
            <table className="w-full border-collapse">
              <thead><tr className="bg-neutral-100"><th className="border border-black p-2 text-left">Particulars / तपशील</th><th className="border border-black p-2 text-right">Amount (₹)</th></tr></thead>
              <tbody>
                <tr><td className="border border-black p-2">Hall charges / सभागृह भाडे</td><td className="num border border-black p-2 text-right">{inr(booking.hall_charges)}</td></tr>
                {(charges as BookingCharge[] | null)?.map((c) => <tr key={c.id}><td className="border border-black p-2">{LABELS.chargeKind[c.kind]}{c.description ? ` – ${c.description}` : ""}</td><td className="num border border-black p-2 text-right">{inr(c.amount)}</td></tr>)}
                {booking.member_discount > 0 && <tr><td className="border border-black p-2">Member discount / सभासद सवलत</td><td className="num border border-black p-2 text-right">− {inr(booking.member_discount)}</td></tr>}
                <tr><td className="border border-black p-2">Taxable amount</td><td className="num border border-black p-2 text-right">{inr(fin.taxable_amount)}</td></tr>
                <tr><td className="border border-black p-2">CGST @ {half}%</td><td className="num border border-black p-2 text-right">{inr(fin.gst_amount / 2, { decimals: true })}</td></tr>
                <tr><td className="border border-black p-2">SGST @ {half}%</td><td className="num border border-black p-2 text-right">{inr(fin.gst_amount / 2, { decimals: true })}</td></tr>
                <tr className="font-bold"><td className="border border-black p-2">Total / एकूण</td><td className="num border border-black p-2 text-right">{inr(fin.total_payable)}</td></tr>
                <tr><td className="border border-black p-2">Refundable security deposit / अनामत रक्कम (परत मिळणारी)</td><td className="num border border-black p-2 text-right">{inr(booking.deposit_amount)}</td></tr>
                {doc === "confirmation" && <>
                  <tr><td className="border border-black p-2">Received so far / जमा</td><td className="num border border-black p-2 text-right">{inr(fin.paid)}</td></tr>
                  <tr className="font-bold"><td className="border border-black p-2">Balance payable / शिल्लक</td><td className="num border border-black p-2 text-right">{inr(fin.balance)}</td></tr>
                </>}
              </tbody>
            </table>
            <p className="mt-1 text-xs">Total in words: {amountInWords(Number(fin.total_payable))}</p>
            {doc === "confirmation" && (payments as Payment[] | null)?.length ? (
              <p className="mt-2 text-xs">Payments: {(payments as Payment[]).filter((p) => !p.kind.includes("refund")).map((p) => `Rct ${p.receipt_no ?? "—"} ${fmtDate(p.paid_on)} ${inr(p.amount)} (${LABELS.paymentMode[p.mode]})`).join("; ")}</p>
            ) : null}
            {doc === "quotation" && <p className="mt-2 text-xs">This quotation is valid for 7 days. Booking is confirmed only on receipt of advance. / ही दरसूची ७ दिवसांसाठी वैध आहे; आगाऊ रक्कम मिळाल्यावरच आरक्षण निश्चित होईल.</p>}
          </section>
        )}

        {doc !== "receipt" && (
          <section className="mt-5 grid grid-cols-2 gap-6 text-[11px]">
            <div><div className="mb-1 font-semibold">Terms & conditions</div><pre className="whitespace-pre-wrap font-[inherit]">{String(s.terms ?? "")}</pre></div>
            <div><div className="mb-1 font-semibold">अटी व शर्ती</div><pre className="whitespace-pre-wrap font-[inherit]">{String(s.terms_mr ?? "")}</pre></div>
          </section>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-black pt-1">Customer signature / ग्राहकाची सही</div>
          <div className="border-t border-black pt-1 text-right">For {String(s.org_name ?? "")} / अधिकृत सही</div>
        </footer>
      </article>
    </main>
  );
}

function Row({ k, v, span }: { k: string; v: React.ReactNode; span?: boolean }) {
  return (
    <div className={`flex gap-2 ${span ? "col-span-2" : ""}`}>
      <span className="w-40 shrink-0 text-neutral-600">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
