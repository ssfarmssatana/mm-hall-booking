import { getHalls, getSession, getSettings, can } from "@/lib/data";
import { PageHeader } from "@/components/app/page-header";
import { BookingForm } from "../booking-form";
import type { Booking } from "@/lib/types";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, profile } = await getSession();
  const [halls, settings] = await Promise.all([getHalls(), getSettings()]);

  let prefill: (Partial<Booking> & { enquiry_id?: number }) | undefined;
  if (sp.enquiry) {
    const { data: e } = await supabase.from("enquiries").select("*").eq("id", Number(sp.enquiry)).single();
    if (e) prefill = { enquiry_id: e.id, customer_name: e.customer_name, mobile: e.mobile, email: e.email, address: e.address, programme_type: e.programme_type, expected_guests: e.expected_guests, hall_id: e.preferred_hall_id ?? undefined, hall_charges: e.quoted_amount ?? undefined };
  }
  if (sp.date) {
    prefill = { ...prefill, start_at: new Date(`${sp.date}T${sp.start || "09:00"}:00`).toISOString(), end_at: new Date(`${sp.date}T${sp.end || "14:00"}:00`).toISOString(), hall_id: sp.hall ? Number(sp.hall) : prefill?.hall_id };
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New booking" subtitle="Fill the register entry. Booking number is assigned automatically." />
      <BookingForm halls={halls} gstRate={Number(settings.gst_rate ?? 18)} canDiscount={can(profile, "accounts")} prefill={prefill} />
    </div>
  );
}
