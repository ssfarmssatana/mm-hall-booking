import Link from "next/link";
import { getHalls, getProfiles, getSession } from "@/lib/data";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { LABELS, type EnquiryStatus, type EnquirySource } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EnquiryStatusBadge } from "@/components/ui/status-badge";
import { NewEnquiryButton } from "./new-enquiry-button";
import { SearchBox } from "@/components/app/search-box";

export const metadata = { title: "Enquiries" };

const TABS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "due", label: "Due today" },
  { key: "booked", label: "Booked" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All" },
];

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.status === "follow_up" ? "due" : sp.tab || "open";
  const q = sp.q?.trim() || "";
  const { supabase } = await getSession();
  const [halls, profiles] = await Promise.all([getHalls(), getProfiles()]);
  const today = todayISO();

  let query = supabase.from("enquiries").select("*").order("created_at", { ascending: false }).limit(300);
  if (tab === "open") query = query.in("status", ["new", "follow_up"]).order("next_follow_up", { ascending: true, nullsFirst: false });
  if (tab === "due") query = query.in("status", ["new", "follow_up"]).lte("next_follow_up", today).order("next_follow_up");
  if (tab === "booked") query = query.eq("status", "booked");
  if (tab === "lost") query = query.eq("status", "lost");
  if (q) query = query.or(`customer_name.ilike.%${q}%,mobile.ilike.%${q}%,programme_type.ilike.%${q}%`);
  const { data: rows } = await query;
  const hallName = (id: number | null) => halls.find((h) => h.id === id)?.name ?? "—";
  const who = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Every enquiry, with its next follow-up.">
        <NewEnquiryButton halls={halls} profiles={profiles} />
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md bg-surface-2 p-1">
          {TABS.map((t) => (
            <Link key={t.key} href={`/enquiries?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <SearchBox placeholder="Search name, mobile, programme" />
      </div>

      <div className="rounded-lg border border-line bg-surface">
        <Table>
          <THead>
            <TR>
              <TH>#</TH><TH>Customer</TH><TH className="hidden md:table-cell">Programme / Hall</TH><TH className="hidden sm:table-cell">Event</TH><TH>Follow-up</TH><TH className="hidden lg:table-cell">Quoted</TH><TH className="hidden lg:table-cell">Source · By</TH><TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {!rows?.length && <TR><TD colSpan={8} className="py-10 text-center text-muted">No enquiries here. Add one with the button above.</TD></TR>}
            {rows?.map((e) => {
              const overdue = e.status !== "booked" && e.status !== "lost" && e.next_follow_up && e.next_follow_up < today;
              return (
                <TR key={e.id}>
                  <TD className="num text-muted">{e.enquiry_no}</TD>
                  <TD>
                    <Link href={`/enquiries/${e.id}`} className="font-medium text-ink hover:text-accent">{e.customer_name}</Link>
                    <div className="text-xs text-muted">{e.mobile}</div>
                  </TD>
                  <TD className="hidden md:table-cell">{e.programme_type || "—"}<div className="text-xs text-muted">{hallName(e.preferred_hall_id)}</div></TD>
                  <TD className="hidden sm:table-cell">{fmtDate(e.event_date)}</TD>
                  <TD className={overdue ? "font-medium text-danger" : e.next_follow_up === today ? "font-medium text-warn" : ""}>{e.status === "booked" || e.status === "lost" ? "—" : fmtDate(e.next_follow_up)}</TD>
                  <TD className="num hidden lg:table-cell">{e.quoted_amount ? inr(e.quoted_amount) : "—"}</TD>
                  <TD className="hidden text-xs text-muted lg:table-cell">{LABELS.enquirySource[e.source as EnquirySource]} · {who(e.assigned_to)}</TD>
                  <TD><EnquiryStatusBadge status={e.status as EnquiryStatus} /></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
