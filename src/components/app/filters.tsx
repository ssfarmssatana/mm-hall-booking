"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/field";
import type { Hall } from "@/lib/types";
import { useTransition } from "react";

/** Shared date-range / hall / basis filter bar. Values live in the URL so pages are shareable & server-rendered. */
export function RangeFilters({ halls, from, to, hall, basis, showBasis = true }: { halls: Hall[]; from: string; to: string; hall: string; basis?: string; showBasis?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    start(() => router.replace(`${pathname}?${p.toString()}`));
  };

  const preset = (days: number | "month" | "fy") => {
    const now = new Date();
    let f: Date, t: Date = now;
    if (days === "month") f = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (days === "fy") { const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; f = new Date(y, 3, 1); t = new Date(y + 1, 2, 31); }
    else f = new Date(now.getTime() - days * 86400e3);
    const p = new URLSearchParams(sp.toString());
    p.set("from", f.toISOString().slice(0, 10));
    p.set("to", t.toISOString().slice(0, 10));
    start(() => router.replace(`${pathname}?${p.toString()}`));
  };

  return (
    <div className={`flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 ${pending ? "opacity-70" : ""}`}>
      <label className="flex-1 text-xs text-ink-2 sm:flex-none">From<Input type="date" value={from} onChange={(e) => set("from", e.target.value)} className="mt-1 h-9 w-full sm:w-[10.5rem]" /></label>
      <label className="flex-1 text-xs text-ink-2 sm:flex-none">To<Input type="date" value={to} onChange={(e) => set("to", e.target.value)} className="mt-1 h-9 w-full sm:w-[10.5rem]" /></label>
      <label className="text-xs text-ink-2">Hall
        <Select value={hall} onChange={(e) => set("hall", e.target.value)} className="mt-1 h-9 w-44">
          <option value="">All halls</option>
          {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </label>
      {showBasis && (
        <label className="text-xs text-ink-2">Date basis
          <Select value={basis || "booking_date"} onChange={(e) => set("basis", e.target.value)} className="mt-1 h-9 w-44">
            <option value="booking_date">Booking entry date</option>
            <option value="event_date">Event date</option>
          </Select>
        </label>
      )}
      <div className="ml-auto flex gap-1 text-xs">
        {([["30d", 30], ["This month", "month"], ["This FY", "fy"]] as const).map(([l, v]) => (
          <button key={l} type="button" onClick={() => preset(v)} className="rounded-md border border-line-2 px-2 py-1.5 hover:bg-surface-2 cursor-pointer">{l}</button>
        ))}
      </div>
    </div>
  );
}
