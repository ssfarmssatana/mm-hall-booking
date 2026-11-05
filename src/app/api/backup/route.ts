import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Manual full-data download (admin only – enforced by export_all()). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_all");
  if (error) return new NextResponse(error.message, { status: 403 });
  const name = `mm-hall-booking-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
