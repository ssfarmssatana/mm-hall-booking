import { getNotifications, getSession, getSettings } from "@/lib/data";
import { Shell } from "@/components/app/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const [settings, notifications] = await Promise.all([getSettings(), getNotifications()]);
  return (
    <Shell profile={profile} orgName={String(settings.org_name ?? "Maratha Mandal Mulund")} notifications={notifications}>
      {children}
    </Shell>
  );
}
