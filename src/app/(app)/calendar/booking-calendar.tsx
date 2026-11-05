"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMonths, addWeeks, addDays } from "date-fns";
import { enIN } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus, Hall } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { fmtRange } from "@/lib/format";

export interface CalEvent {
  id: number; title: string; start: string; end: string; hall_id: number; status: BookingStatus; booking_no: number; mobile: string; buffer: number;
}
type RBCEvent = Omit<CalEvent, "start" | "end"> & { start: Date; end: Date };

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }), getDay, locales: { "en-IN": enIN } });

const STATUS_COLORS: Record<BookingStatus, string> = { confirmed: "#1a7f4b", tentative: "#b7791f", blocked: "#64748b", cancelled: "#b42318" };

export function BookingCalendar({ events, halls, initialDate }: { events: CalEvent[]; halls: Hall[]; initialDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(new Date(initialDate));
  const [view, setView] = useState<View>("month");
  const [hallFilter, setHallFilter] = useState<number | "all">("all");
  const [selected, setSelected] = useState<RBCEvent | null>(null);

  // Live refresh when anyone changes a booking.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("cal-bookings").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => router.refresh()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [router]);

  const data = useMemo<RBCEvent[]>(
    () => events.filter((e) => hallFilter === "all" || e.hall_id === hallFilter).map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })),
    [events, hallFilter],
  );

  const eventPropGetter = useCallback((e: RBCEvent) => {
    const hall = halls.find((h) => h.id === e.hall_id);
    const base = STATUS_COLORS[e.status];
    return { style: { backgroundColor: base, borderLeft: hallFilter === "all" && hall ? `4px solid ${hall.color}` : undefined, color: "#fff", opacity: e.status === "tentative" ? 0.9 : 1 } };
  }, [halls, hallFilter]);

  const onSelectSlot = (s: SlotInfo) => {
    const d = format(s.start, "yyyy-MM-dd");
    const hasTime = view !== "month";
    const q = new URLSearchParams({ date: d });
    if (hasTime) { q.set("start", format(s.start, "HH:mm")); q.set("end", format(s.end, "HH:mm")); }
    if (hallFilter !== "all") q.set("hall", String(hallFilter));
    router.push(`/bookings/new?${q.toString()}`);
  };

  const navigate = (dir: -1 | 1) => {
    const next = view === "month" ? addMonths(date, dir) : view === "week" ? addWeeks(date, dir) : addDays(date, dir);
    setDate(next);
    // keep server window centred around what is being viewed
    if (Math.abs(next.getMonth() - new Date(initialDate).getMonth()) >= 3) router.replace(`/calendar?d=${format(next, "yyyy-MM-dd")}`);
  };

  const title = view === "month" ? format(date, "MMMM yyyy") : view === "day" ? format(date, "EEEE, dd MMM yyyy") : `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), "dd MMM yyyy")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Previous"><ChevronLeft /></Button>
          <Button variant="secondary" size="sm" onClick={() => setDate(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)} aria-label="Next"><ChevronRight /></Button>
        </div>
        <div className="min-w-0 flex-1 truncate text-base font-semibold">{title}</div>
        <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
          {(["month", "week", "day", "agenda"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded px-2.5 py-1 capitalize cursor-pointer ${view === v ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>{v}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
          <button type="button" onClick={() => setHallFilter("all")} className={`rounded px-2.5 py-1 cursor-pointer ${hallFilter === "all" ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>All halls</button>
          {halls.map((h) => (
            <button key={h.id} type="button" onClick={() => setHallFilter(h.id)} className={`flex items-center gap-1.5 rounded px-2.5 py-1 cursor-pointer ${hallFilter === h.id ? "bg-surface font-medium shadow-sm" : "text-ink-2"}`}>
              <span className="inline-block size-2.5 rounded-full" style={{ background: h.color }} />{h.name}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[72vh] min-h-[520px]">
        <Calendar
          localizer={localizer}
          events={data}
          date={date}
          view={view}
          onNavigate={setDate}
          onView={setView}
          toolbar={false}
          selectable
          onSelectSlot={onSelectSlot}
          onSelectEvent={(e) => setSelected(e as RBCEvent)}
          eventPropGetter={eventPropGetter}
          popup
          step={30}
          timeslots={2}
          min={new Date(1970, 0, 1, 6, 0)}
          max={new Date(1970, 0, 1, 23, 59)}
          culture="en-IN"
          formats={{ eventTimeRangeFormat: () => "", timeGutterFormat: (d: Date) => format(d, "h a"), dayHeaderFormat: (d: Date) => format(d, "EEE dd MMM"), agendaDateFormat: (d: Date) => format(d, "EEE dd MMM") }}
        />
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent title={`Booking #${selected.booking_no}`}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-base font-semibold">{selected.title}</span><BookingStatusBadge status={selected.status} /></div>
              <div>{fmtRange(selected.start.toISOString(), selected.end.toISOString())}</div>
              <div className="text-muted">{halls.find((h) => h.id === selected.hall_id)?.name} · buffer {selected.buffer} min · <a className="text-accent" href={`tel:${selected.mobile}`}>{selected.mobile}</a></div>
              <div className="pt-2"><Button asChild><Link href={`/bookings/${selected.id}`}>Open booking</Link></Button></div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
