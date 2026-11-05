"use server";

import { revalidatePath } from "next/cache";
import { getSession, can } from "@/lib/data";
import type { ActionState } from "../enquiries/actions";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) return { error: "Admin only." };
  const text = ["org_name", "org_name_mr", "org_address", "org_phone", "org_email", "gstin", "terms", "terms_mr"];
  const nums = ["gst_rate", "buffer_minutes", "tentative_hold_days"];
  const rows = [
    ...text.map((k) => ({ key: k, value: JSON.stringify(str(fd.get(k))) })),
    ...nums.map((k) => ({ key: k, value: JSON.stringify(Number(str(fd.get(k)) || 0)) })),
  ];
  for (const r of rows) {
    const { error } = await supabase.from("settings").upsert({ key: r.key, value: JSON.parse(r.value), updated_at: new Date().toISOString() });
    if (error) return { error: error.message };
  }
  // counters
  for (const c of ["booking", "receipt", "enquiry"]) {
    const v = str(fd.get(`counter_${c}`));
    if (v !== "") await supabase.from("counters").upsert({ name: c, value: Number(v) });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveHall(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) return { error: "Admin only." };
  const id = str(fd.get("id"));
  const row = {
    name: str(fd.get("name")), name_mr: str(fd.get("name_mr")) || null, floor: str(fd.get("floor")) || null,
    capacity: str(fd.get("capacity")) ? Number(fd.get("capacity")) : null, is_ac: fd.get("is_ac") === "on",
    base_rate: Number(str(fd.get("base_rate")) || 0), deposit_default: Number(str(fd.get("deposit_default")) || 0),
    color: str(fd.get("color")) || "#2563eb", sort_order: Number(str(fd.get("sort_order")) || 0), active: fd.get("active") !== "off",
  };
  if (!row.name) return { error: "Hall name is required." };
  const { error } = id ? await supabase.from("halls").update(row).eq("id", Number(id)) : await supabase.from("halls").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleHall(id: number, active: boolean) {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) return;
  await supabase.from("halls").update({ active }).eq("id", id);
  revalidatePath("/", "layout");
}
