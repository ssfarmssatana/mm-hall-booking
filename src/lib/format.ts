import { format, parseISO, isValid } from "date-fns";

export const TZ = "Asia/Kolkata";

export function inr(n: number | string | null | undefined, opts: { decimals?: boolean } = {}) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ? 2 : 0,
    minimumFractionDigits: opts.decimals ? 2 : 0,
  }).format(isNaN(v) ? 0 : v);
}

export function num(n: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN").format(Number(n ?? 0));
}

export function fmtDate(d: string | Date | null | undefined, f = "dd MMM yyyy") {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return isValid(dt) ? format(dt, f) : "—";
}

export function fmtDateTime(d: string | Date | null | undefined) {
  return fmtDate(d, "dd MMM yyyy, h:mm a");
}

export function fmtTime(d: string | Date | null | undefined) {
  return fmtDate(d, "h:mm a");
}

export function fmtRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (format(s, "yyyy-MM-dd") === format(e, "yyyy-MM-dd")) {
    return `${format(s, "EEE, dd MMM yyyy")} · ${format(s, "h:mm a")} – ${format(e, "h:mm a")}`;
  }
  return `${format(s, "dd MMM yyyy h:mm a")} – ${format(e, "dd MMM yyyy h:mm a")}`;
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

/** yyyy-MM-dd in local time (never use toISOString().slice for dates – it shifts to UTC). */
export function localISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Combine a yyyy-MM-dd date and HH:mm time (local) into an ISO string. */
export function toISO(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

export function splitISO(iso: string) {
  const d = parseISO(iso);
  return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
}

/** Number to Indian words for receipts. */
export function amountInWords(n: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
  const three = (x: number) => (x > 99 ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
  n = Math.round(n);
  if (n === 0) return "Zero";
  let s = "";
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) s += three(crore) + " Crore ";
  if (lakh) s += three(lakh) + " Lakh ";
  if (thousand) s += three(thousand) + " Thousand ";
  if (n) s += three(n);
  return s.trim() + " Rupees Only";
}
