import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/data";
import { loadReport, fyStart } from "@/lib/report";
import type { Hall } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

const BRAND = "FF9A3412", HEAD = "FFF3EDE6", LINE = "FFE4DFD5";
const INR = '"₹"#,##0;[Red]-"₹"#,##0';

/** Formatted multi-sheet Excel report (Summary, Monthly, Bookings, Payments, Enquiries). */
export async function GET(request: Request) {
  const { supabase } = await getSession();

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || fyStart();
  const to = url.searchParams.get("to") || todayISO();
  const hall = url.searchParams.get("hall") || "";
  const basis = url.searchParams.get("basis") || "booking_date";

  const [{ data: hallsData }, { data: settings }] = await Promise.all([
    supabase.from("halls").select("*").order("sort_order"),
    supabase.from("settings").select("key,value").in("key", ["org_name", "org_address", "gstin"]),
  ]);
  const halls = (hallsData ?? []) as Hall[];
  const cfg = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value as string]));
  const r = await loadReport(supabase, halls, from, to, hall, basis);
  const hallName = hall ? halls.find((h) => h.id === Number(hall))?.name ?? "" : "All halls";
  const period = `${format(parseISO(from), "dd MMM yyyy")} to ${format(parseISO(to), "dd MMM yyyy")}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = cfg.org_name || "Maratha Mandal Mulund";
  wb.created = new Date();

  const title = (ws: ExcelJS.Worksheet, text: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    const c = ws.getCell(1, 1); c.value = cfg.org_name || "Maratha Mandal Mulund"; c.font = { bold: true, size: 14, color: { argb: BRAND } };
    ws.mergeCells(2, 1, 2, cols);
    ws.getCell(2, 1).value = `${text} · ${period} · ${hallName}`; ws.getCell(2, 1).font = { size: 10, color: { argb: "FF7A736A" } };
    ws.getRow(3).height = 6;
  };
  const header = (ws: ExcelJS.Worksheet, row: number, labels: string[]) => {
    const rr = ws.getRow(row);
    labels.forEach((l, i) => { const c = rr.getCell(i + 1); c.value = l; c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; c.border = { bottom: { style: "thin", color: { argb: LINE } } }; c.alignment = { vertical: "middle", wrapText: true }; });
    rr.height = 20;
    ws.views = [{ state: "frozen", ySplit: row }];
    ws.autoFilter = { from: { row, column: 1 }, to: { row, column: labels.length } };
  };
  const widths = (ws: ExcelJS.Worksheet, w: number[]) => w.forEach((x, i) => (ws.getColumn(i + 1).width = x));

  // ---- Summary
  {
    const ws = wb.addWorksheet("Summary");
    title(ws, "Hall booking report", 4);
    widths(ws, [34, 18, 4, 30]);
    const s = r.stats;
    const kv: [string, number | string, string?][] = [
      ["Total enquiries", s.enquiries_total ?? 0], ["Converted enquiries", s.enquiries_converted ?? 0], ["Lost enquiries", s.enquiries_lost ?? 0], ["Open enquiries", s.enquiries_open ?? 0],
      ["Conversion rate", `${s.conversion_pct ?? 0}%`], ["Confirmed bookings", s.bookings_confirmed ?? 0], ["Tentative bookings", s.bookings_tentative ?? 0], ["Cancelled bookings", s.bookings_cancelled ?? 0],
      ["Confirmed booking value", Number(s.confirmed_value ?? 0), INR], ["Collections in period", Number(s.collections ?? 0), INR], ["Outstanding balance", Number(s.outstanding ?? 0), INR],
      ["Security deposits held", Number(s.deposits_held ?? 0), INR], ["Deposit refunds pending", Number(s.deposits_refund_pending ?? 0), INR],
    ];
    header(ws, 4, ["Figure", "Value"]);
    ws.autoFilter = undefined;
    kv.forEach(([k, v, fmt], i) => { const row = ws.getRow(5 + i); row.getCell(1).value = k; const c = row.getCell(2); c.value = v; if (fmt) c.numFmt = fmt; c.alignment = { horizontal: "right" }; if (k === "Conversion rate") { c.font = { bold: true, color: { argb: BRAND } }; row.getCell(1).font = { bold: true }; } });
    ws.getCell(5 + kv.length + 1, 1).value = `Date basis for bookings: ${basis === "event_date" ? "Event date" : "Booking entry date"}. Generated ${format(new Date(), "dd MMM yyyy, h:mm a")}.`;
    ws.getCell(5 + kv.length + 1, 1).font = { italic: true, size: 9, color: { argb: "FF7A736A" } };

    // side tables
    let row = 4;
    const side = (heading: string, rows: [string, number | string][], fmt?: string) => {
      ws.getCell(row, 4).value = heading; ws.getCell(row, 4).font = { bold: true }; ws.getCell(row, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } }; ws.getCell(row, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
      ws.getColumn(5).width = 14;
      rows.forEach(([k, v], i) => { ws.getCell(row + 1 + i, 4).value = k; const c = ws.getCell(row + 1 + i, 5); c.value = v; if (fmt) c.numFmt = fmt; c.alignment = { horizontal: "right" }; });
      row += rows.length + 2;
    };
    side("Confirmed bookings by hall", r.hallShare.map((h) => [h.name, h.value]));
    side("Booking value by hall", r.hallShare.map((h) => [h.name, h.amount]), INR);
    side("Enquiry sources", r.sources.map((x) => [x.name, `${x.booked} / ${x.total}`]));
    side("Lost reasons", r.lostReasons.map((x) => [x.name, x.value]));
    side("Collections by mode", r.paymentModes.map((x) => [x.name, x.value]), INR);
  }

  // ---- Monthly
  {
    const ws = wb.addWorksheet("Monthly");
    title(ws, "Month-wise enquiry, conversion and revenue", 9);
    header(ws, 4, ["Month", "Enquiries", "Converted", "Lost", "Conversion %", "Confirmed bookings", "Booking value", "Collections", "Events held"]);
    widths(ws, [16, 11, 11, 9, 13, 18, 16, 16, 12]);
    r.monthly.forEach((m, i) => {
      const row = ws.getRow(5 + i);
      row.values = [format(parseISO(m.month), "MMM yyyy"), m.enquiries, m.converted, m.lost, m.enquiries ? m.converted / m.enquiries : 0, m.bookings_confirmed, m.confirmed_value, m.collections, m.events_held];
      row.getCell(5).numFmt = "0.0%"; row.getCell(7).numFmt = INR; row.getCell(8).numFmt = INR;
    });
    const t = 5 + r.monthly.length;
    const tr = ws.getRow(t);
    tr.values = ["Total", { formula: `SUM(B5:B${t - 1})` }, { formula: `SUM(C5:C${t - 1})` }, { formula: `SUM(D5:D${t - 1})` }, { formula: `IF(B${t}=0,0,C${t}/B${t})` }, { formula: `SUM(F5:F${t - 1})` }, { formula: `SUM(G5:G${t - 1})` }, { formula: `SUM(H5:H${t - 1})` }, { formula: `SUM(I5:I${t - 1})` }];
    tr.font = { bold: true }; tr.getCell(5).numFmt = "0.0%"; tr.getCell(7).numFmt = INR; tr.getCell(8).numFmt = INR;
    tr.eachCell((c) => (c.border = { top: { style: "thin" }, bottom: { style: "double" } }));
  }

  // ---- Bookings
  {
    const dateCol = basis === "event_date" ? "start_at" : "booking_date";
    let q = supabase.from("bookings").select("*").gte(dateCol, from).lte(dateCol, basis === "event_date" ? to + "T23:59:59" : to).order("booking_no");
    if (hall) q = q.eq("hall_id", Number(hall));
    const { data } = await q;
    const ids = (data ?? []).map((b) => b.id);
    const { data: fin } = ids.length ? await supabase.from("booking_financials").select("*").in("booking_id", ids) : { data: [] };
    const fmap = new Map((fin ?? []).map((f) => [f.booking_id, f]));
    const ws = wb.addWorksheet("Bookings");
    title(ws, "Booking register", 18);
    const cols = ["No.", "Booking date", "Status", "Customer", "Mobile", "Programme", "Hall", "Event start", "Event end", "Guests", "Hall charges", "Extra charges", "Member discount", "GST", "Total payable", "Received", "Balance", "Deposit held"];
    header(ws, 4, cols);
    widths(ws, [7, 12, 11, 28, 13, 20, 22, 18, 18, 8, 13, 13, 14, 12, 14, 13, 13, 13]);
    (data ?? []).forEach((b, i) => {
      const f = fmap.get(b.id) ?? {};
      const row = ws.getRow(5 + i);
      row.values = [b.booking_no, new Date(b.booking_date), b.status, b.customer_name, b.mobile, b.programme_type, halls.find((h) => h.id === b.hall_id)?.name, new Date(b.start_at), new Date(b.end_at), b.expected_guests, Number(b.hall_charges), Number(f.extra_charges ?? 0), Number(b.member_discount), Number(f.gst_amount ?? 0), Number(f.total_payable ?? 0), Number(f.paid ?? 0), Number(f.balance ?? 0), Number(f.deposit_held ?? 0)];
      row.getCell(2).numFmt = "dd-mmm-yyyy"; row.getCell(8).numFmt = "dd-mmm-yyyy hh:mm"; row.getCell(9).numFmt = "dd-mmm-yyyy hh:mm";
      [11, 12, 13, 14, 15, 16, 17, 18].forEach((c) => (row.getCell(c).numFmt = INR));
      if (b.status === "cancelled") row.font = { color: { argb: "FF999999" }, strike: false };
    });
    const t = 5 + (data?.length ?? 0);
    const tr = ws.getRow(t); tr.getCell(4).value = "Total"; tr.font = { bold: true };
    [11, 12, 13, 14, 15, 16, 17, 18].forEach((c) => { const L = ws.getColumn(c).letter; tr.getCell(c).value = { formula: `SUM(${L}5:${L}${t - 1})` }; tr.getCell(c).numFmt = INR; });
  }

  // ---- Payments
  {
    let q = supabase.from("payments").select("*, bookings!inner(booking_no, customer_name, hall_id)").gte("paid_on", from).lte("paid_on", to).order("paid_on").order("id");
    if (hall) q = q.eq("bookings.hall_id", Number(hall));
    const { data } = await q;
    const ws = wb.addWorksheet("Payments");
    title(ws, "Payments received and refunded", 9);
    header(ws, 4, ["Receipt", "Date", "Booking", "Customer", "Type", "Mode", "Reference", "Amount", "Notes"]);
    widths(ws, [9, 12, 9, 28, 16, 14, 20, 14, 30]);
    const KIND: Record<string, string> = { advance: "Advance", instalment: "Instalment", deposit: "Security deposit", refund: "Refund", deposit_refund: "Deposit refund" };
    (data ?? []).forEach((p, i) => {
      const b = p.bookings as { booking_no: number; customer_name: string };
      const row = ws.getRow(5 + i);
      const signed = p.kind.includes("refund") ? -Number(p.amount) : Number(p.amount);
      row.values = [p.receipt_no, new Date(p.paid_on), b.booking_no, b.customer_name, KIND[p.kind], p.mode, p.reference, signed, p.notes];
      row.getCell(2).numFmt = "dd-mmm-yyyy"; row.getCell(8).numFmt = INR;
    });
    const t = 5 + (data?.length ?? 0);
    ws.getRow(t).getCell(4).value = "Net total"; ws.getRow(t).getCell(8).value = { formula: `SUM(H5:H${t - 1})` }; ws.getRow(t).getCell(8).numFmt = INR; ws.getRow(t).font = { bold: true };
  }

  // ---- Enquiries
  {
    let q = supabase.from("enquiries").select("*").gte("created_at", from).lte("created_at", to + "T23:59:59").order("enquiry_no");
    if (hall) q = q.eq("preferred_hall_id", Number(hall));
    const { data } = await q;
    const ws = wb.addWorksheet("Enquiries");
    title(ws, "Enquiry register", 13);
    header(ws, 4, ["No.", "Received", "Customer", "Mobile", "Programme", "Preferred hall", "Event date", "Guests", "Quoted", "Source", "Status", "Lost reason", "Next follow-up"]);
    widths(ws, [7, 12, 28, 13, 20, 22, 12, 8, 12, 11, 11, 22, 14]);
    (data ?? []).forEach((e, i) => {
      const row = ws.getRow(5 + i);
      row.values = [e.enquiry_no, new Date(e.created_at), e.customer_name, e.mobile, e.programme_type, halls.find((h) => h.id === e.preferred_hall_id)?.name, e.event_date ? new Date(e.event_date) : null, e.expected_guests, e.quoted_amount ? Number(e.quoted_amount) : null, e.source, e.status, e.lost_reason, e.next_follow_up ? new Date(e.next_follow_up) : null];
      row.getCell(2).numFmt = "dd-mmm-yyyy"; row.getCell(7).numFmt = "dd-mmm-yyyy"; row.getCell(9).numFmt = INR; row.getCell(13).numFmt = "dd-mmm-yyyy";
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="MMM_Hall_Report_${from}_to_${to}.xlsx"`,
    },
  });
}
