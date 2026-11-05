import { redirect } from "next/navigation";
import { getHalls, getSession, getSettings, can } from "@/lib/data";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm, HallsManager } from "./settings-ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) redirect("/dashboard");
  const [settings, halls, { data: counters }] = await Promise.all([getSettings(), getHalls(true), supabase.from("counters").select("*")]);
  const c = Object.fromEntries((counters ?? []).map((r) => [r.name, r.value]));
  return (
    <>
      <PageHeader title="Settings" subtitle="Mandal details, GST, buffer time, halls and running numbers." />
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsForm settings={settings} counters={c} />
        <HallsManager halls={halls} />
      </div>
    </>
  );
}
