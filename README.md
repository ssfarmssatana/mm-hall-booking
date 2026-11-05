# Maratha Mandal Mulund – Hall Booking System

Online booking office for the Mandal's halls: enquiries → follow-ups → bookings → payments → reports,
shared live by all office staff. Built to run entirely on free tiers.

| Layer | Service | Cost |
|---|---|---|
| App | Next.js 16 · TypeScript · Tailwind · shadcn-style UI · react-big-calendar | – |
| Hosting | Vercel Hobby (auto-deploys from GitHub `main`) | Free |
| Database + Auth + file storage | Supabase Free (Postgres with Row Level Security) | Free |
| Code | GitHub private repo | Free |

## Features
Dashboard (enquiries, conversion %, confirmed value, collections, outstanding, deposits; booking-date vs
event-date basis) · Calendar (month/week/day/agenda, per hall, colour-coded, click-to-book, live refresh) ·
Enquiries (source, follow-up log, New → Follow-up → Booked/Lost with reason, one-click convert) ·
Bookings (full register fields, auto numbers continuing from the paper register, GST = CGST+SGST,
member discount, extra charges, tentative holds with expiry, reschedule keeping original slot, cancellation with
charge and refund calculation, database-enforced double-booking guard incl. setup/cleaning buffer) ·
Payments (instalments, deposits kept separate, receipt numbers, due dates, overdue list) · Reports (monthly
enquiry/conversion table as in the Mandal's PDF, lost reasons, sources, CSV exports) · Printable
quotation / confirmation / receipt (English + Marathi) · Roles: staff / accounts / admin · Audit trail of every
change · In-app notifications · Manual + nightly backups with restore.

## 1. Database (Supabase)
1. Supabase → **SQL Editor** → paste and run, in order:
   `supabase/migrations/0001_schema.sql`, then `0002_seed.sql`
   (edit hall names / rates / last register numbers in `0002_seed.sql` first if you know them).
2. **Authentication → Users → Add user → Create new user**: admin's email + password, *Auto Confirm User* ON.
3. Put that email into `supabase/migrations/0003_make_admin.sql` and run it.
4. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up"
   (new accounts are created only from the app's Users screen; any stray sign-up is inactive anyway).

## 2. Deploy (Vercel)
1. Push this repo to GitHub, then Vercel → **Add New → Project → Import** the repo (framework: Next.js, defaults).
2. **Environment variables** (Settings → Environment Variables, all environments):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the *anon / publishable* key (`sb_publishable_…`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the *secret / service_role* key – server only, never in code |
   | `CRON_SECRET` | any long random string (e.g. `openssl rand -hex 24`) |
   | `TZ` | `Asia/Kolkata` |
3. Deploy. The site is live at `https://<project>.vercel.app`. Add a custom domain later under Settings → Domains.
4. `vercel.json` schedules the nightly backup (`/api/cron/backup`) at 03:00 IST ± 59 min (Hobby plan allows once a day).

## 3. Local development
```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
```

## Backups & data ownership
* **Backup → Download full backup**: one JSON file of every table (admin only).
* **Nightly**: the cron job stores a copy in the private `backups` bucket (keeps 30). Also acts as the
  keep-alive that stops a free Supabase project pausing after 7 days idle.
* **Restore**: Backup screen → choose file → type RESTORE. Replaces all business data (not user accounts).
* Limitations of the free setup: no point-in-time recovery; daily granularity; the job can't run if Supabase has
  already paused (unpause from the Supabase dashboard, then it resumes).

## Security model
* Only the anon key reaches the browser. Every query runs as the logged-in user; Postgres RLS decides what they see.
* `profiles.role`: `staff` (enquiries, bookings), `accounts` (+ payments, discounts, cancellations, audit log),
  `admin` (+ users, halls, settings, backup/restore). Enforced in RLS policies and triggers, not just the UI.
* Triggers write an `audit_log` row for every insert/update/delete on bookings, payments, charges, halls, settings.
* The service-role key is used only inside server actions/routes for creating users and the backup job.

## Free-tier limits to keep in mind
* Vercel Hobby: non-commercial use policy; 100 GB bandwidth; cron once/day. Pro ($20/mo) only if the Mandal
  ever wants to be strictly within terms or needs more.
* Supabase Free: 500 MB DB (years of bookings), pauses after 7 days of no activity (the cron prevents this),
  built-in auth email rate-limited (we never send email – admins set passwords directly).
