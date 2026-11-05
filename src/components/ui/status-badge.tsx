import { Badge } from "@/components/ui/badge";
import { LABELS, type BookingStatus, type EnquiryStatus } from "@/lib/types";

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const v = status === "confirmed" ? "ok" : status === "tentative" ? "warn" : status === "cancelled" ? "danger" : "default";
  return <Badge variant={v}>{LABELS.bookingStatus[status]}</Badge>;
}

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const v = status === "booked" ? "ok" : status === "follow_up" ? "warn" : status === "lost" ? "danger" : "accent";
  return <Badge variant={v}>{LABELS.enquiryStatus[status]}</Badge>;
}
