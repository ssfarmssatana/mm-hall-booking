"use server";

import { revalidatePath } from "next/cache";
import { getSession, can } from "@/lib/data";
import type { ActionState } from "../enquiries/actions";

export async function restoreBackup(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) return { error: "Admin only." };
  const file = fd.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Choose a backup file (.json)." };
  if (String(fd.get("confirm")).trim().toUpperCase() !== "RESTORE") return { error: 'Type RESTORE to confirm – this replaces all current data.' };
  let payload: unknown;
  try { payload = JSON.parse(await file.text()); } catch { return { error: "That file is not a valid backup." }; }
  if (!payload || typeof payload !== "object" || !("bookings" in payload)) return { error: "That file is not a backup from this system." };
  const { error } = await supabase.rpc("restore_all", { p: payload });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function restoreFromStorage(name: string): Promise<ActionState> {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) return { error: "Admin only." };
  const { data, error } = await supabase.storage.from("backups").download(name);
  if (error || !data) return { error: error?.message ?? "Could not download backup." };
  const payload = JSON.parse(await data.text());
  const { error: e2 } = await supabase.rpc("restore_all", { p: payload });
  if (e2) return { error: e2.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
