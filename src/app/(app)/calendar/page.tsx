import { getHalls, getSession } from "@/lib/data";
import { PageHeader } from "@/components/app/page-header";
import { BookingCalendar, type CalEvent } from "./booking-calendar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await getSession();
  const halls = await getHalls();
  // Load a wide window (±4 months) once; navigation inside it is instant.
  const anchor = sp.d ? new Date(sp.d) : new Date();
  const from = new Date(anchor.getFullYear(), anchor.getMonth() - 4, 1).toISOString();
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 5, 0).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("id,booking_no,customer_name,programme_type,hall_id,start_at,end_at,status,mobile,tentative_expires_at,buffer_minutes")
    .in("status", ["tentative", "confirmed", "blocked"])
    .gte("end_at", from).lte("start_at", to);

  const events: CalEvent[] = (data ?? []).map((b) => ({
    id: b.id, title: b.status === "blocked" ? `Blocked – ${b.customer_name}` : `${b.customer_name}${b.programme_type ? ` · ${b.programme_type}` : ""}`,
    start: b.start_at, end: b.end_at, hall_id: b.hall_id, status: b.status, booking_no: b.booking_no, mobile: b.mobile, buffer: b.buffer_minutes,
  }));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Green confirmed · amber tentative · grey blocked. Click a free day to start a booking.">
        <Button asChild><Link href="/bookings/new"><Plus /> New booking</Link></Button>
      </PageHeader>
      <BookingCalendar events={events} halls={halls} initialDate={anchor.toISOString()} />
    </>
  );
}
