-- =====================================================================
-- Migration 0003: promote the first administrator.
-- 1. Create the admin user first in Supabase Dashboard → Authentication → Users
--    → "Add user" → "Create new user" (email + password, auto-confirm ON).
-- 2. Replace the email below and run this file.
-- =====================================================================

update profiles
   set role = 'admin', active = true, full_name = 'Administrator'
 where email = 'ADMIN_EMAIL_HERE';
