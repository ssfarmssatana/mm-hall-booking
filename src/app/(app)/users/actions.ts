"use server";

import { revalidatePath } from "next/cache";
import { getSession, can } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "../enquiries/actions";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

async function requireAdmin() {
  const { profile } = await getSession();
  if (!can(profile, "admin")) throw new Error("Admin only");
  return profile;
}

/** Creates the auth user with a password set by the admin (no email needed – free-tier friendly). */
export async function createUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  try { await requireAdmin(); } catch { return { error: "Admin only." }; }
  const email = str(fd.get("email")).toLowerCase();
  const password = str(fd.get("password"));
  const full_name = str(fd.get("full_name"));
  const role = str(fd.get("role")) || "staff";
  if (!email || !full_name) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  let admin;
  try { admin = createAdminClient(); } catch { return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." }; }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, role } });
  if (error) return { error: error.message };
  await admin.from("profiles").upsert({ id: data.user.id, email, full_name, role, active: true });
  revalidatePath("/users");
  return { ok: true };
}

export async function updateUser(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  let me;
  try { me = await requireAdmin(); } catch { return { error: "Admin only." }; }
  const role = str(fd.get("role"));
  const full_name = str(fd.get("full_name"));
  const active = fd.get("active") === "on";
  if (id === me.id && (role !== "admin" || !active)) return { error: "You cannot remove your own admin access." };
  const { supabase } = await getSession();
  const { error } = await supabase.from("profiles").update({ role, full_name, active }).eq("id", id);
  if (error) return { error: error.message };
  const password = str(fd.get("password"));
  if (password) {
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    try {
      const admin = createAdminClient();
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { password });
      if (e2) return { error: e2.message };
    } catch { return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." }; }
  }
  revalidatePath("/users");
  return { ok: true };
}
