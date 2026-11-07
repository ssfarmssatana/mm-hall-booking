import Link from "next/link";
import { notFound } from "next/navigation";
import { getHalls, getProfiles, getSession, getSettings } from "@/lib/data";
import { fmtDate, fmtDateTime, inr, todayISO } from "@/lib/format";
import { LABELS, type Enquiry, type EnquiryFollowup } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnquiryStatusBadge } from "@/components/ui/status-badge";
import { EnquiryDetailActions } from "./detail-actions";

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  const [{ data: e }, { data: fus }, halls, profiles, settings] = await Promise.all([
    supabase.from("enquiries").select("*").eq("id", Number(id)).single(),
    supabase.from("enquiry_followups").select("*").eq("enquiry_id", Number(id)).order("created_at", { ascending: false }),
    getHalls(), getProfiles(), getSettings(),
  ]);
  if (!e) notFound();
  const enq = e as Enquiry;
  const hall = halls.find((h) => h.id === enq.preferred_hall_id);
  const who = (uid: string | null) => profiles.find((p) => p.id === uid)?.full_name ?? "—";

  const rows: [string, React.ReactNode][] = [
    ["Mobile", <a key="m" href={`tel:${enq.mobile}`} className="text-accent">{enq.mobile}</a>],
    ["Email", enq.email || "—"],
    ["Address", enq.address || "—"],
    ["Programme", enq.programme_type || "—"],
    ["Preferred hall", hall?.name ?? "Not decided"],
    ["Event date", `${fmtDate(enq.event_date)}${enq.start_time ? ` · ${enq.start_time.slice(0, 5)}–${enq.end_time?.slice(0, 5) ?? ""}` : ""}`],
    ["Expected guests", enq.expected_guests ?? "—"],
    ["Quoted amount", enq.quoted_amount ? inr(enq.quoted_amount) : "—"],
    ["Source", LABELS.enquirySource[enq.source]],
    ["Handled by", who(enq.assigned_to)],
    ["Received", fmtDateTime(enq.created_at)],
  ];

  return (
    <>
      <PageHeader title={enq.customer_name} subtitle={`Enquiry #${enq.enquiry_no}`}>
        <EnquiryStatusBadge status={enq.status} />
        <EnquiryDetailActions enquiry={enq} halls={halls} profiles={profiles} gstRate={Number(settings.gst_rate ?? 18)} />
      </PageHeader>

      {enq.status === "booked" && enq.converted_booking_id && (
        <div className="mb-4 rounded-md border border-ok bg-ok-soft px-4 py-2 text-sm text-ok">
          Converted to booking. <Link href={`/bookings/${enq.converted_booking_id}`} className="font-semibold underline">Open booking</Link>
        </div>
      )}
      {enq.status === "lost" && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger-soft px-4 py-2 text-sm text-danger">Marked lost — {enq.lost_reason}</div>
      )}
      {enq.status !== "booked" && enq.status !== "lost" && enq.next_follow_up && (
        <div className={`mb-4 rounded-md border px-4 py-2 text-sm ${enq.next_follow_up < todayISO() ? "border-danger/40 bg-danger-soft text-danger" : "border-warn/40 bg-warn-soft text-warn"}`}>
          Next follow-up: {fmtDate(enq.next_follow_up, "EEEE, dd MMM yyyy")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y divide-line text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 px-4 py-2"><dt className="text-muted">{k}</dt><dd className="col-span-2">{v}</dd></div>
              ))}
              {enq.notes && <div className="px-4 py-2"><dt className="text-muted">Notes</dt><dd className="whitespace-pre-wrap">{enq.notes}</dd></div>}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Follow-up history</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!fus?.length && <p className="px-4 py-6 text-center text-sm text-muted">No follow-ups recorded yet. Use “Log follow-up” after every call.</p>}
            <ul className="divide-y divide-line">
              {(fus as EnquiryFollowup[] | null)?.map((f) => (
                <li key={f.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{fmtDateTime(f.created_at)} · {who(f.created_by)}</span>
                    {f.next_follow_up && <span>Next: {fmtDate(f.next_follow_up)}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{f.note}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
