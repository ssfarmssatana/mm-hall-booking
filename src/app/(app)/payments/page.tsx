import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getHalls, getSession, can } from "@/lib/data";
import { fmtDate, inr, todayISO, localISO } from "@/lib/format";
import { LABELS, type BookingFinancials, type BookingStatus, type Payment, type PaymentMode } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { RangeFilters } from "@/components/app/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  if (!can(profile, "accounts")) redirect("/dashboard");
  const halls = await getHalls();
  const now = new Date();
  const from = sp.from || localISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = sp.to || todayISO();
  const hall = sp.hall || "";

  let pq = supabase.from("payments").select("*, bookings!inner(id, booking_no, customer_name, hall_id)").gte("paid_on", from).lte("paid_on", to).order("paid_on", { ascending: false }).order("id", { ascending: false });
  if (hall) pq = pq.eq("bookings.hall_id", Number(hall));
  const [{ data: payments }, { data: open }] = await Promise.all([
    pq,
    supabase.from("bookings").select("id, booking_no, customer_name, hall_id, start_at, status").in("status", ["confirmed", "tentative"]).order("start_at"),
  ]);
  const openIds = (open ?? []).filter((b) => !hall || b.hall_id === Number(hall)).map((b) => b.id);
  const { data: fins } = openIds.length ? await supabase.from("booking_financials").select("*").in("booking_id", openIds).gt("balance", 0) : { data: [] };
  const finMap = new Map((fins ?? []).map((f) => [f.booking_id, f as BookingFinancials]));
  const outstanding = (open ?? []).filter((b) => finMap.has(b.id));

  const byMode: Record<string, number> = {};
  let received = 0, refunded = 0, deposits = 0, depRefund = 0;
  for (const p of (payments ?? []) as (Payment & { bookings: { booking_no: number; customer_name: string } })[]) {
    const a = Number(p.amount);
    if (p.kind === "advance" || p.kind === "instalment") { received += a; byMode[p.mode] = (byMode[p.mode] ?? 0) + a; }
    else if (p.kind === "deposit") deposits += a;
    else if (p.kind === "refund") refunded += a;
    else if (p.kind === "deposit_refund") depRefund += a;
  }
  const qs = `from=${from}&to=${to}${hall ? `&hall=${hall}` : ""}`;

  return (
    <>
      <PageHeader title="Payments" subtitle="Collections, refunds and what is still due.">
        <Button asChild variant="secondary"><a href={`/api/export?type=payments&${qs}`}><Download /> Export CSV</a></Button>
      </PageHeader>
      <RangeFilters halls={halls} from={from} to={to} hall={hall} showBasis={false} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hall charges received" value={inr(received)} sub={Object.entries(byMode).map(([m, v]) => `${LABELS.paymentMode[m as PaymentMode]} ${inr(v)}`).join(" · ") || "—"} />
        <Stat label="Deposits received" value={inr(deposits)} sub="refundable, held separately" />
        <Stat label="Refunds paid" value={inr(refunded + depRefund)} sub={`${inr(refunded)} charges · ${inr(depRefund)} deposits`} />
        <Stat label="Outstanding (all open bookings)" value={inr(outstanding.reduce((s, b) => s + Number(finMap.get(b.id)!.balance), 0))} sub={`${outstanding.length} bookings`} warn />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Payments in period</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><TR><TH>Receipt</TH><TH>Date</TH><TH>Booking</TH><TH>Type</TH><TH>Mode · Ref</TH><TH className="text-right">Amount</TH></TR></THead>
              <TBody>
                {!payments?.length && <TR><TD colSpan={6} className="py-8 text-center text-muted">No payments in this period.</TD></TR>}
                {(payments as (Payment & { bookings: { id: number; booking_no: number; customer_name: string } })[] | null)?.map((p) => (
                  <TR key={p.id}>
                    <TD className="num">{p.receipt_no ?? "—"}</TD>
                    <TD>{fmtDate(p.paid_on)}</TD>
                    <TD><Link href={`/bookings/${p.bookings.id}`} className="font-medium hover:text-accent">#{p.bookings.booking_no} {p.bookings.customer_name}</Link></TD>
                    <TD>{LABELS.paymentKind[p.kind]}</TD>
                    <TD className="text-xs">{LABELS.paymentMode[p.mode]}{p.reference ? ` · ${p.reference}` : ""}</TD>
                    <TD className={`num text-right ${p.kind.includes("refund") ? "text-danger" : ""}`}>{p.kind.includes("refund") ? "− " : ""}{inr(p.amount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Balance outstanding</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!outstanding.length && <p className="px-4 py-8 text-center text-sm text-muted">Nothing outstanding.</p>}
            <ul className="divide-y divide-line text-sm">
              {outstanding.map((b) => (
                <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">#{b.booking_no} {b.customer_name}</div><div className="text-xs text-muted">Event {fmtDate(b.start_at)} · {LABELS.bookingStatus[b.status as BookingStatus]}</div></div>
                  <span className="num font-semibold text-danger">{inr(finMap.get(b.id)!.balance)}</span>
                </Link></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${warn ? "text-danger" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
