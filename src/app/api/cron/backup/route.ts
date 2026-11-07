import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEEP = 30;

/**
 * Daily job (Vercel Cron, see vercel.json):
 *  1. exports all tables to a JSON file in the private "backups" storage bucket,
 *  2. keeps the newest 30 files,
 *  3. the query itself counts as activity, so the free Supabase project is not paused for inactivity.
 * Limitations: once a day, timing ±59 min on the Hobby plan, logical export (not point-in-time),
 * and it cannot run if the Supabase project is already paused.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorised", { status: 401 });
  }
  let admin;
  try { admin = createAdminClient(); } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }

  const { data, error } = await admin.rpc("export_all");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const name = `auto/${todayISO()}.json`;
  const { error: upErr } = await admin.storage.from("backups").upload(name, JSON.stringify(data), { contentType: "application/json", upsert: true });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: files } = await admin.storage.from("backups").list("auto", { sortBy: { column: "name", order: "desc" } });
  const stale = (files ?? []).slice(KEEP).map((f) => `auto/${f.name}`);
  if (stale.length) await admin.storage.from("backups").remove(stale);

  return NextResponse.json({ ok: true, file: name, kept: Math.min(KEEP, files?.length ?? 0), removed: stale.length });
}
