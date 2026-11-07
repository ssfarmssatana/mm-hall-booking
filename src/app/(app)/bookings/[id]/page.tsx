import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { getHalls, getProfiles, getSession, getSettings, can } from "@/lib/data";
import { fmtDate, fmtDateTime, fmtRange, inr, todayISO } from "@/lib/format";
import { LABELS, type AuditEntry, type Booking, type BookingCharge, type BookingFinancials, type Payment, type PaymentDue } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { BookingActions, ChargeActions, DueActions, PaymentActions } from "./actions-ui";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bid = Number(id);
  const { supabase, profile } = await getSession();
  const [{ data: b }, { data: f }, { data: charges }, { data: payments }, { data: dues }, halls, profiles, settings] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bid).single(),
    supabase.from("booking_financials").select("*").eq("booking_id", bid).single(),
    supabase.from("booking_charges").select("*").eq("booking_id", bid).order("id"),
    supabase.from("payments").select("*").eq("booking_id", bid).order("paid_on").order("id"),
    supabase.from("payment_dues").select("*").eq("booking_id", bid).order("due_date"),
    getHalls(true), getProfiles(), getSettings(),
  ]);
  if (!b) notFound();
  const booking = b as Booking;
  const fin = f as BookingFinancials | null;
  const hall = halls.find((h) => h.id === booking.hall_id);
  const isAccounts = can(profile, "accounts");
  const who = (uid: string | null) => profiles.find((p) => p.id === uid)?.full_name ?? "—";

  let audit: AuditEntry[] = [];
  if (isAccounts) {
    const { data } = await supabase.from("audit_log").select("*").eq("table_name", "bookings").eq("record_id", String(bid)).order("changed_at", { ascending: false }).limit(50);
    audit = (data ?? []) as AuditEntry[];
  }

  const expired = booking.status === "tentative" && booking.tentative_expires_at && new Date(booking.tentative_expires_at) < new Date();

  return (
    <>
      <PageHeader title={`${booking.customer_name}`} subtitle={`Booking #${booking.booking_no} · entered ${fmtDate(booking.booking_date)} by ${who(booking.created_by)}`}>
        <BookingStatusBadge status={booking.status} />
        <Button asChild variant="secondary" size="sm"><Link href={`/print/${bid}?doc=confirmation`} target="_blank"><Printer /> Confirmation</Link></Button>
        <Button asChild variant="secondary" size="sm"><Link href={`/print/${bid}?doc=quotation`} target="_blank"><Printer /> Quotation</Link></Button>
        <BookingActions booking={booking} halls={halls.filter((h) => h.active)} gstRate={Number(settings.gst_rate ?? 18)} canAccounts={isAccounts} />
      </PageHeader>

      {booking.status === "tentative" && (
        <div className={`mb-4 rounded-md border px-4 py-2 text-sm ${expired ? "border-danger/40 bg-danger-soft text-danger" : "border-warn/40 bg-warn-soft text-warn"}`}>
          {expired ? "This tentative hold has expired. Confirm it (record the advance) or cancel it to free the slot." : `Tentative hold — expires ${fmtDateTime(booking.tentative_expires_at)}. Hall is blocked until then.`}
        </div>
      )}
      {booking.status === "cancelled" && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger-soft px-4 py-2 text-sm text-danger">
          Cancelled {fmtDateTime(booking.cancelled_at)} — {booking.cancellation_reason}. Cancellation charge {inr(booking.cancellation_charge)}.
          {fin && fin.paid - fin.refunded - booking.cancellation_charge > 0 && <> Refund due to customer: <b>{inr(fin.paid - fin.refunded - booking.cancellation_charge)}</b>.</>}
        </div>
      )}
      {booking.original_start_at && (
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-4 py-2 text-sm text-ink-2">
          Rescheduled. Original slot: {fmtRange(booking.original_start_at, booking.original_end_at!)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Programme</CardTitle></CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y divide-line text-sm">
              {([
                ["Hall", `${hall?.name ?? "—"}${hall?.is_ac && !/\bAC\b/i.test(hall.name) ? " (AC)" : ""}`],
                ["When", fmtRange(booking.start_at, booking.end_at)],
                ["Buffer", `${booking.buffer_minutes} min before & after`],
                ["Programme", booking.programme_type || "—"],
                ["Guests", booking.expected_guests ?? "—"],
                ["Mobile", <a key="m" href={`tel:${booking.mobile}`} className="text-accent">{booking.mobile}</a>],
                ["Address", booking.address || "—"],
                ["Member no.", booking.member_no || "Non-member"],
                ["Terms", booking.terms_accepted ? "Accepted" : "Not yet accepted"],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 px-4 py-2"><dt className="text-muted">{k}</dt><dd className="col-span-2">{v}</dd></div>
              ))}
              {booking.notes && <div className="px-4 py-2"><dt className="text-muted">Notes</dt><dd className="whitespace-pre-wrap">{booking.notes}</dd></div>}
              {booking.enquiry_id && <div className="px-4 py-2 text-xs"><Link href={`/enquiries/${booking.enquiry_id}`} className="text-accent">From enquiry →</Link></div>}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Amount</CardTitle><ChargeActions bookingId={bid} charges={(charges ?? []) as BookingCharge[]} canDelete={isAccounts} /></CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y divide-line text-sm">
              <Row k="Hall charges" v={inr(booking.hall_charges)} />
              {(charges as BookingCharge[] | null)?.map((c) => <Row key={c.id} k={`${LABELS.chargeKind[c.kind]}${c.description ? ` – ${c.description}` : ""}`} v={inr(c.amount)} />)}
              {booking.member_discount > 0 && <Row k="Member discount" v={`− ${inr(booking.member_discount)}`} />}
              <Row k="Taxable amount" v={inr(fin?.taxable_amount)} />
              <Row k={`CGST ${booking.gst_rate / 2}% + SGST ${booking.gst_rate / 2}%`} v={inr(fin?.gst_amount, { decimals: true })} />
              <Row k="Total payable" v={inr(fin?.total_payable)} bold />
              <Row k="Received" v={inr(fin?.paid)} />
              {Number(fin?.refunded) > 0 && <Row k="Refunded" v={inr(fin?.refunded)} />}
              <Row k="Balance" v={inr(fin?.balance)} bold cls={Number(fin?.balance) > 0 ? "text-danger" : "text-ok"} />
              <div className="px-4 pt-3 text-xs font-semibold text-muted">Refundable security deposit (kept separate)</div>
              <Row k="Deposit agreed" v={inr(booking.deposit_amount)} />
              <Row k="Deposit received" v={inr(fin?.deposit_received)} />
              <Row k="Deposit refunded" v={inr(fin?.deposit_refunded)} />
              <Row k="Deposit held" v={inr(fin?.deposit_held)} bold />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment schedule</CardTitle><DueActions bookingId={bid} canEdit={isAccounts} /></CardHeader>
          <CardContent className="p-0">
            {!dues?.length && <p className="px-4 py-4 text-center text-xs text-muted">No instalment dates set.</p>}
            <ul className="divide-y divide-line text-sm">
              {(dues as PaymentDue[] | null)?.map((d) => {
                const overdue = !d.settled && d.due_date < todayISO();
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-2">
                    <DueActions bookingId={bid} canEdit={isAccounts} due={d} />
                    <div className="flex-1">
                      <div className={d.settled ? "text-muted line-through" : overdue ? "font-medium text-danger" : ""}>{fmtDate(d.due_date)} · {inr(d.amount)}</div>
                      {d.note && <div className="text-xs text-muted">{d.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Payments received</CardTitle><PaymentActions bookingId={bid} canEdit={isAccounts && booking.status !== "blocked"} suggestedAmount={Math.max(0, Number(fin?.balance ?? 0))} depositDue={Math.max(0, booking.deposit_amount - Number(fin?.deposit_received ?? 0))} /></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Receipt</TH><TH>Date</TH><TH>Type</TH><TH>Mode · Reference</TH><TH className="text-right">Amount</TH><TH className="hidden md:table-cell">By</TH><TH></TH></TR></THead>
            <TBody>
              {!payments?.length && <TR><TD colSpan={7} className="py-6 text-center text-muted">No payments recorded yet.</TD></TR>}
              {(payments as Payment[] | null)?.map((p) => (
                <TR key={p.id}>
                  <TD className="num">{p.receipt_no ?? "—"}</TD>
                  <TD>{fmtDate(p.paid_on)}</TD>
                  <TD>{LABELS.paymentKind[p.kind]}</TD>
                  <TD>{LABELS.paymentMode[p.mode]}{p.reference ? ` · ${p.reference}` : ""}{p.notes ? <div className="text-xs text-muted">{p.notes}</div> : null}</TD>
                  <TD className={`num text-right ${p.kind.includes("refund") ? "text-danger" : ""}`}>{p.kind.includes("refund") ? "− " : ""}{inr(p.amount)}</TD>
                  <TD className="hidden text-xs text-muted md:table-cell">{who(p.created_by)}</TD>
                  <TD className="text-right">{p.receipt_no && <Link href={`/print/${bid}?doc=receipt&payment=${p.id}`} target="_blank" className="text-xs text-accent">Receipt</Link>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {isAccounts && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Change history</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!audit.length && <p className="px-4 py-4 text-xs text-muted">No changes recorded.</p>}
            <ul className="divide-y divide-line text-xs">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-2">
                  <span className="text-muted">{fmtDateTime(a.changed_at)} · {who(a.changed_by)} · {a.action}</span>
                  {a.changed_fields && (
                    <div className="mt-0.5 space-x-2">
                      {a.changed_fields.filter((k) => !["updated_at", "slot", "original_start_at", "original_end_at"].includes(k)).map((k) => (
                        <span key={k} className="inline-block rounded bg-surface-2 px-1.5 py-0.5"><b>{k}</b>: {String(a.old_data?.[k] ?? "—")} → {String(a.new_data?.[k] ?? "—")}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Row({ k, v, bold, cls }: { k: string; v: React.ReactNode; bold?: boolean; cls?: string }) {
  return (
    <div className={`flex justify-between gap-2 px-4 py-1.5 ${bold ? "font-semibold" : ""}`}>
      <dt className={bold ? "" : "text-muted"}>{k}</dt>
      <dd className={`num ${cls ?? ""}`}>{v}</dd>
    </div>
  );
}
