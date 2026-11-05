import { redirect } from "next/navigation";
import { getProfiles, getSession, can } from "@/lib/data";
import { PageHeader } from "@/components/app/page-header";
import { UsersManager } from "./users-ui";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const { profile } = await getSession();
  if (!can(profile, "admin")) redirect("/dashboard");
  const profiles = await getProfiles();
  return (
    <>
      <PageHeader title="Users" subtitle="Staff can record enquiries and bookings. Accounts can also take payments, discounts and cancellations. Administrators can do everything." />
      <UsersManager profiles={profiles} meId={profile.id} />
    </>
  );
}
