"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { format, parseISO } from "date-fns";

export interface MonthRow {
  month: string; enquiries: number; converted: number; lost: number; bookings_confirmed: number; bookings_cancelled: number; confirmed_value: number; collections: number; events_held: number;
}

const C = { enq: "#94a3b8", conv: "#1a7f4b", lost: "#b42318", value: "#9a3412", coll: "#0f766e", line: "#9a3412" };
const PALETTE = ["#9a3412", "#0f766e", "#7c3aed", "#b7791f", "#475569", "#1a7f4b", "#b42318", "#2563eb"];
const mon = (m: string) => format(parseISO(m), "MMM yy");
const inrShort = (v: number) => (v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${(v / 1e3).toFixed(0)}k` : `₹${v}`);
const inrFull = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const tooltipStyle = { contentStyle: { borderRadius: 8, border: "1px solid #e4dfd5", fontSize: 12 }, labelStyle: { fontWeight: 600 } };
const axis = { tick: { fontSize: 11, fill: "#7a736a" }, axisLine: false, tickLine: false } as const;

export function EnquiryConversionChart({ data, height = 260 }: { data: MonthRow[]; height?: number }) {
  const rows = data.map((r) => ({ ...r, name: mon(r.month), rate: r.enquiries ? Math.round((r.converted * 100) / r.enquiries) : 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eee9df" />
        <XAxis dataKey="name" {...axis} />
        <YAxis yAxisId="n" {...axis} allowDecimals={false} />
        <YAxis yAxisId="pct" orientation="right" {...axis} unit="%" domain={[0, 100]} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "Conversion %" ? `${v}%` : v, n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} yAxisId="n" dataKey="enquiries" name="Enquiries" fill={C.enq} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} yAxisId="n" dataKey="converted" name="Converted" fill={C.conv} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} yAxisId="n" dataKey="lost" name="Lost" fill={C.lost} radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} yAxisId="pct" type="monotone" dataKey="rate" name="Conversion %" stroke={C.line} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data, height = 260 }: { data: MonthRow[]; height?: number }) {
  const rows = data.map((r) => ({ name: mon(r.month), value: Number(r.confirmed_value), collections: Number(r.collections) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eee9df" />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} tickFormatter={inrShort} width={56} />
        <Tooltip {...tooltipStyle} formatter={(v) => inrFull(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="value" name="Confirmed booking value" fill={C.value} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="collections" name="Collections" fill={C.coll} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, height = 160 }: { data: MonthRow[]; height?: number }) {
  const rows = data.map((r) => ({ name: mon(r.month), enquiries: r.enquiries, bookings: r.bookings_confirmed }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eee9df" />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="enquiries" name="Enquiries" stroke={C.enq} strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="bookings" name="Confirmed bookings" stroke={C.conv} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ShareDonut({ data, height = 220, unit = "" }: { data: { name: string; value: number }[]; height?: number; unit?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted">No data in this period.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="#fff">
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v}${unit} (${Math.round((Number(v) * 100) / total)}%)`, n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, height = 220, color = C.lost }: { data: { name: string; value: number }[]; height?: number; color?: string }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">No data in this period.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 32 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <XAxis type="number" {...axis} allowDecimals={false} hide />
        <YAxis type="category" dataKey="name" {...axis} width={150} />
        <Tooltip {...tooltipStyle} />
        <Bar isAnimationActive={false} barSize={18} dataKey="value" name="Enquiries" fill={color} radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, fill: "#4a443d" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
