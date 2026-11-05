import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSession, can } from "@/lib/data";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestoreForm, RestoreFromStorageButton } from "./backup-ui";

export const metadata = { title: "Backup" };

export default async function BackupPage() {
  const { supabase, profile } = await getSession();
  if (!can(profile, "admin")) redirect("/dashboard");
  const { data: files } = await supabase.storage.from("backups").list("auto", { sortBy: { column: "name", order: "desc" }, limit: 40 });
  const { count: bookings } = await supabase.from("bookings").select("*", { count: "exact", head: true });
  const { count: enquiries } = await supabase.from("enquiries").select("*", { count: "exact", head: true });

  return (
    <>
      <PageHeader title="Backup & restore" subtitle="Your data belongs to the Mandal. Download a full copy any time." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Download a backup now</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Exports every table ({bookings ?? 0} bookings, {enquiries ?? 0} enquiries, payments, settings, change history) as one JSON file. Keep a copy on the office computer or Google Drive each month.</p>
            <Button asChild><a href="/api/backup"><Download /> Download full backup (.json)</a></Button>
            <p className="text-xs text-muted">For Excel-friendly files use the CSV exports on the Reports page.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Automatic daily backups</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p className="mb-3">A scheduled job runs every night, stores a copy in private cloud storage and keeps the last 30 days. It also keeps the free database from being paused for inactivity.</p>
            {!files?.length && <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">No automatic backups yet. They appear here after the first nightly run (needs CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY set in Vercel).</p>}
            <ul className="divide-y divide-line">
              {files?.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-2 py-2">
                  <span className="num">{f.name.replace(".json", "")} <span className="text-xs text-muted">· {((f.metadata?.size ?? 0) / 1024).toFixed(0)} KB</span></span>
                  <RestoreFromStorageButton name={`auto/${f.name}`} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-danger/40">
          <CardHeader><CardTitle className="text-danger">Restore from a file</CardTitle></CardHeader>
          <CardContent>
            <RestoreForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
