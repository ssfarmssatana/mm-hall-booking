export type UserRole = "admin" | "accounts" | "staff";
export type EnquiryStatus = "new" | "follow_up" | "booked" | "lost";
export type EnquirySource = "phone" | "walk_in" | "whatsapp" | "website" | "referral" | "other";
export type BookingStatus = "tentative" | "confirmed" | "cancelled" | "blocked";
export type PaymentMode = "cash" | "cheque" | "upi" | "bank_transfer" | "card";
export type PaymentKind = "advance" | "instalment" | "deposit" | "refund" | "deposit_refund";
export type ChargeKind = "overtime" | "cleaning" | "equipment" | "catering_royalty" | "other";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Hall {
  id: number;
  name: string;
  name_mr: string | null;
  floor: string | null;
  capacity: number | null;
  is_ac: boolean;
  base_rate: number;
  deposit_default: number;
  color: string;
  sort_order: number;
  active: boolean;
}

export interface Enquiry {
  id: number;
  enquiry_no: number;
  customer_name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  preferred_hall_id: number | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  programme_type: string | null;
  expected_guests: number | null;
  quoted_amount: number | null;
  source: EnquirySource;
  status: EnquiryStatus;
  lost_reason: string | null;
  next_follow_up: string | null;
  notes: string | null;
  assigned_to: string | null;
  converted_booking_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryFollowup {
  id: number;
  enquiry_id: number;
  note: string;
  outcome: EnquiryStatus | null;
  next_follow_up: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Booking {
  id: number;
  booking_no: number;
  booking_date: string;
  enquiry_id: number | null;
  hall_id: number;
  customer_name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  member_no: string | null;
  programme_type: string | null;
  expected_guests: number | null;
  start_at: string;
  end_at: string;
  buffer_minutes: number;
  status: BookingStatus;
  tentative_expires_at: string | null;
  hall_charges: number;
  member_discount: number;
  gst_rate: number;
  deposit_amount: number;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_charge: number;
  rescheduled_from_id: number | null;
  original_start_at: string | null;
  original_end_at: string | null;
  terms_accepted: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingFinancials {
  booking_id: number;
  hall_charges: number;
  extra_charges: number;
  member_discount: number;
  taxable_amount: number;
  gst_amount: number;
  total_payable: number;
  deposit_amount: number;
  paid: number;
  refunded: number;
  deposit_received: number;
  deposit_refunded: number;
  balance: number;
  deposit_held: number;
}

export interface BookingCharge {
  id: number;
  booking_id: number;
  kind: ChargeKind;
  description: string | null;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: number;
  booking_id: number;
  receipt_no: number | null;
  kind: PaymentKind;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  paid_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaymentDue {
  id: number;
  booking_id: number;
  due_date: string;
  amount: number;
  note: string | null;
  settled: boolean;
}

export interface AuditEntry {
  id: number;
  table_name: string;
  record_id: string;
  action: string;
  changed_by: string | null;
  changed_at: string;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface DashboardStats {
  enquiries_total: number;
  enquiries_converted: number;
  enquiries_lost: number;
  enquiries_open: number;
  conversion_pct: number;
  confirmed_value: number;
  collections: number;
  outstanding: number;
  deposits_held: number;
  deposits_refund_pending: number;
  bookings_confirmed: number;
  bookings_tentative: number;
  bookings_cancelled: number;
}

export type Settings = Record<string, string | number>;

export const LABELS = {
  enquiryStatus: { new: "New", follow_up: "Follow-up", booked: "Booked", lost: "Lost" } as Record<EnquiryStatus, string>,
  enquirySource: { phone: "Phone", walk_in: "Walk-in", whatsapp: "WhatsApp", website: "Website", referral: "Referral", other: "Other" } as Record<EnquirySource, string>,
  bookingStatus: { tentative: "Tentative", confirmed: "Confirmed", cancelled: "Cancelled", blocked: "Blocked" } as Record<BookingStatus, string>,
  paymentMode: { cash: "Cash", cheque: "Cheque", upi: "UPI", bank_transfer: "Bank transfer", card: "Card" } as Record<PaymentMode, string>,
  paymentKind: { advance: "Advance", instalment: "Instalment", deposit: "Security deposit", refund: "Refund", deposit_refund: "Deposit refund" } as Record<PaymentKind, string>,
  chargeKind: { overtime: "Overtime", cleaning: "Cleaning", equipment: "Equipment", catering_royalty: "Catering royalty", other: "Other" } as Record<ChargeKind, string>,
  role: { admin: "Administrator", accounts: "Accounts", staff: "Staff" } as Record<UserRole, string>,
};

export const LOST_REASONS = [
  "Booked elsewhere",
  "Price too high",
  "Date not available",
  "No response from customer",
  "Programme cancelled",
  "Other",
];

export const PROGRAMME_TYPES = [
  "Wedding", "Reception", "Engagement", "Birthday", "Naming ceremony", "Thread ceremony",
  "Religious programme", "Satyanarayan pooja", "Haldi / Mehendi", "Anniversary", "Corporate / Seminar",
  "School / College event", "Exhibition", "Garba / Cultural", "Condolence meet", "Other",
];
