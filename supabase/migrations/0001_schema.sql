-- =====================================================================
-- Maratha Mandal Mulund – Hall Booking System
-- Migration 0001: schema, security (RLS), triggers, reporting functions
-- Run once in Supabase SQL Editor (or `supabase db push`).
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- Enums ----------
create type user_role as enum ('admin', 'accounts', 'staff');
create type enquiry_status as enum ('new', 'follow_up', 'booked', 'lost');
create type enquiry_source as enum ('phone', 'walk_in', 'whatsapp', 'website', 'referral', 'other');
create type booking_status as enum ('tentative', 'confirmed', 'cancelled', 'blocked');
create type payment_mode as enum ('cash', 'cheque', 'upi', 'bank_transfer', 'card');
create type payment_kind as enum ('advance', 'instalment', 'deposit', 'refund', 'deposit_refund');
create type charge_kind as enum ('overtime', 'cleaning', 'equipment', 'catering_royalty', 'other');

-- ---------- Profiles (one per auth user) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user is created in Supabase Auth.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- New accounts start INACTIVE. The admin "Add user" screen activates them;
  -- anyone who somehow self-registers cannot see any data.
  insert into profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff'),
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: role of the calling user
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active;
$$;

create or replace function is_admin() returns boolean
language sql stable as $$ select my_role() = 'admin' $$;

create or replace function is_accounts() returns boolean
language sql stable as $$ select my_role() in ('admin', 'accounts') $$;

create or replace function is_staff() returns boolean
language sql stable as $$ select my_role() is not null $$;

-- ---------- Settings & counters ----------
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table counters (
  name text primary key,
  value integer not null
);

create or replace function next_counter(p_name text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update counters set value = value + 1 where name = p_name returning value into v;
  if v is null then
    insert into counters (name, value) values (p_name, 1) returning value into v;
  end if;
  return v;
end $$;

-- ---------- Halls ----------
create table halls (
  id serial primary key,
  name text not null,
  name_mr text,
  floor text,
  capacity integer,
  is_ac boolean not null default false,
  base_rate numeric(12,2) not null default 0,
  deposit_default numeric(12,2) not null default 0,
  color text not null default '#2563eb',
  sort_order integer not null default 0,
  active boolean not null default true
);

-- ---------- Enquiries ----------
create table enquiries (
  id serial primary key,
  enquiry_no integer not null unique,
  customer_name text not null,
  mobile text not null,
  email text,
  address text,
  preferred_hall_id integer references halls(id),
  event_date date,
  start_time time,
  end_time time,
  programme_type text,
  expected_guests integer,
  quoted_amount numeric(12,2),
  source enquiry_source not null default 'phone',
  status enquiry_status not null default 'new',
  lost_reason text,
  next_follow_up date,
  notes text,
  assigned_to uuid references profiles(id),
  converted_booking_id integer,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on enquiries (status, next_follow_up);
create index on enquiries (created_at);

create table enquiry_followups (
  id serial primary key,
  enquiry_id integer not null references enquiries(id) on delete cascade,
  note text not null,
  outcome enquiry_status,
  next_follow_up date,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Bookings ----------
create table bookings (
  id serial primary key,
  booking_no integer not null unique,
  booking_date date not null default current_date,
  enquiry_id integer references enquiries(id),
  hall_id integer not null references halls(id),
  customer_name text not null,
  mobile text not null,
  email text,
  address text,
  member_no text,
  programme_type text,
  expected_guests integer,
  start_at timestamptz not null,
  end_at timestamptz not null,
  buffer_minutes integer not null default 0,
  status booking_status not null default 'tentative',
  tentative_expires_at timestamptz,
  hall_charges numeric(12,2) not null default 0,
  member_discount numeric(12,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  deposit_amount numeric(12,2) not null default 0,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancellation_charge numeric(12,2) not null default 0,
  rescheduled_from_id integer references bookings(id),
  original_start_at timestamptz,
  original_end_at timestamptz,
  terms_accepted boolean not null default false,
  notes text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Occupied range incl. setup/cleaning buffer; maintained by trigger (timestamptz arithmetic is not immutable).
  slot tstzrange not null default 'empty',
  constraint bookings_time_check check (end_at > start_at),
  -- Database-level double-booking guard (includes setup/cleaning buffer).
  constraint bookings_no_overlap exclude using gist (hall_id with =, slot with &&)
    where (status in ('tentative', 'confirmed', 'blocked'))
);
create index on bookings (start_at);
create index on bookings (booking_date);
create index on bookings (status);

alter table enquiries
  add constraint enquiries_converted_fk foreign key (converted_booking_id) references bookings(id);

create table booking_charges (
  id serial primary key,
  booking_id integer not null references bookings(id) on delete cascade,
  kind charge_kind not null default 'other',
  description text,
  amount numeric(12,2) not null default 0,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table payments (
  id serial primary key,
  booking_id integer not null references bookings(id) on delete restrict,
  receipt_no integer,
  kind payment_kind not null default 'instalment',
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode not null default 'cash',
  reference text,          -- cheque no / UPI id / bank name
  paid_on date not null default current_date,
  notes text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on payments (booking_id);
create index on payments (paid_on);

create table payment_dues (
  id serial primary key,
  booking_id integer not null references bookings(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null,
  note text,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Audit log ----------
create table audit_log (
  id bigserial primary key,
  table_name text not null,
  record_id text not null,
  action text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  changed_fields text[],
  old_data jsonb,
  new_data jsonb
);
create index on audit_log (table_name, record_id);
create index on audit_log (changed_at);

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fields text[];
  k text;
  oldj jsonb; newj jsonb;
begin
  if tg_op = 'INSERT' then
    newj := to_jsonb(new);
    insert into audit_log (table_name, record_id, action, changed_by, new_data)
      values (tg_table_name, new.id::text, 'insert', auth.uid(), newj);
    return new;
  elsif tg_op = 'UPDATE' then
    oldj := to_jsonb(old); newj := to_jsonb(new);
    fields := array(select key from jsonb_each(newj) where newj->key is distinct from oldj->key and key not in ('updated_at','slot'));
    if array_length(fields, 1) is null then return new; end if;
    insert into audit_log (table_name, record_id, action, changed_by, changed_fields, old_data, new_data)
      values (tg_table_name, new.id::text, 'update', auth.uid(), fields,
              (select jsonb_object_agg(f, oldj->f) from unnest(fields) f),
              (select jsonb_object_agg(f, newj->f) from unnest(fields) f));
    return new;
  else
    oldj := to_jsonb(old);
    insert into audit_log (table_name, record_id, action, changed_by, old_data)
      values (tg_table_name, old.id::text, 'delete', auth.uid(), oldj);
    return old;
  end if;
end $$;

create trigger audit_bookings after insert or update or delete on bookings for each row execute function audit_trigger();
create trigger audit_payments after insert or update or delete on payments for each row execute function audit_trigger();
create trigger audit_charges after insert or update or delete on booking_charges for each row execute function audit_trigger();
create trigger audit_enquiries after update or delete on enquiries for each row execute function audit_trigger();
create trigger audit_halls after insert or update or delete on halls for each row execute function audit_trigger();
create trigger audit_settings after update on settings for each row execute function audit_trigger();

-- ---------- Business-rule triggers ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger bookings_touch before update on bookings for each row execute function touch_updated_at();
create trigger enquiries_touch before update on enquiries for each row execute function touch_updated_at();

-- Numbers, defaults and role checks on bookings.
create or replace function bookings_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare r user_role := my_role();
begin
  if tg_op = 'INSERT' then
    if new.booking_no is null or new.booking_no = 0 then
      new.booking_no := next_counter('booking');
    end if;
    if new.buffer_minutes = 0 then
      new.buffer_minutes := coalesce((select (value->>0)::int from settings where key = 'buffer_minutes'), 0);
    end if;
    if new.status = 'tentative' and new.tentative_expires_at is null then
      new.tentative_expires_at := now() + (coalesce((select (value->>0)::int from settings where key = 'tentative_hold_days'), 3) || ' days')::interval;
    end if;
    if new.member_discount <> 0 and r not in ('admin', 'accounts') then
      raise exception 'Only accounts/admin may apply a member discount';
    end if;
  else
    if new.buffer_minutes = 0 then
      new.buffer_minutes := coalesce((select (value->>0)::int from settings where key = 'buffer_minutes'), 0);
    end if;
    if new.member_discount is distinct from old.member_discount and r not in ('admin', 'accounts') then
      raise exception 'Only accounts/admin may change the member discount';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      if r not in ('admin', 'accounts') then
        raise exception 'Only accounts/admin may cancel a booking';
      end if;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
    if (new.start_at, new.end_at) is distinct from (old.start_at, old.end_at) then
      new.original_start_at := coalesce(old.original_start_at, old.start_at);
      new.original_end_at := coalesce(old.original_end_at, old.end_at);
    end if;
    if new.status = 'confirmed' then new.tentative_expires_at := null; end if;
  end if;
  new.slot := tstzrange(new.start_at - make_interval(mins => new.buffer_minutes),
                        new.end_at + make_interval(mins => new.buffer_minutes), '[)');
  return new;
end $$;
create trigger bookings_bw before insert or update on bookings for each row execute function bookings_before_write();

create or replace function enquiries_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.enquiry_no is null or new.enquiry_no = 0 then
    new.enquiry_no := next_counter('enquiry');
  end if;
  return new;
end $$;
create trigger enquiries_bi before insert on enquiries for each row execute function enquiries_before_insert();

create or replace function payments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('advance', 'instalment', 'deposit') and new.receipt_no is null then
    new.receipt_no := next_counter('receipt');
  end if;
  return new;
end $$;
create trigger payments_bi before insert on payments for each row execute function payments_before_insert();

-- Convert an enquiry into a booking atomically (no retyping).
create or replace function convert_enquiry(
  p_enquiry_id integer, p_hall_id integer, p_start_at timestamptz, p_end_at timestamptz,
  p_hall_charges numeric, p_deposit numeric, p_status booking_status default 'tentative'
) returns integer
language plpgsql security definer set search_path = public as $$
declare e enquiries%rowtype; bid integer;
begin
  if not is_staff() then raise exception 'Not permitted'; end if;
  select * into e from enquiries where id = p_enquiry_id for update;
  if e.converted_booking_id is not null then raise exception 'Enquiry already converted'; end if;
  insert into bookings (enquiry_id, hall_id, customer_name, mobile, email, address, programme_type,
                        expected_guests, start_at, end_at, status, hall_charges, deposit_amount,
                        gst_rate, created_by)
  values (e.id, p_hall_id, e.customer_name, e.mobile, e.email, e.address, e.programme_type,
          e.expected_guests, p_start_at, p_end_at, p_status, p_hall_charges, p_deposit,
          coalesce((select (value->>0)::numeric from settings where key='gst_rate'), 18), auth.uid())
  returning id into bid;
  update enquiries set status = 'booked', converted_booking_id = bid, updated_at = now() where id = e.id;
  return bid;
end $$;

-- ---------- Financial view ----------
create or replace view booking_financials as
select
  b.id as booking_id,
  b.hall_charges,
  coalesce(c.extra, 0) as extra_charges,
  b.member_discount,
  (b.hall_charges + coalesce(c.extra, 0) - b.member_discount) as taxable_amount,
  round((b.hall_charges + coalesce(c.extra, 0) - b.member_discount) * b.gst_rate / 100, 2) as gst_amount,
  (case when b.status = 'cancelled' then b.cancellation_charge
        else round((b.hall_charges + coalesce(c.extra, 0) - b.member_discount) * (1 + b.gst_rate / 100), 2) end) as total_payable,
  b.deposit_amount,
  coalesce(p.paid, 0) as paid,
  coalesce(p.refunded, 0) as refunded,
  coalesce(p.deposit_received, 0) as deposit_received,
  coalesce(p.deposit_refunded, 0) as deposit_refunded,
  (case when b.status = 'cancelled' then b.cancellation_charge
        else round((b.hall_charges + coalesce(c.extra, 0) - b.member_discount) * (1 + b.gst_rate / 100), 2) end)
    - coalesce(p.paid, 0) + coalesce(p.refunded, 0) as balance,
  coalesce(p.deposit_received, 0) - coalesce(p.deposit_refunded, 0) as deposit_held
from bookings b
left join (select booking_id, sum(amount) extra from booking_charges group by booking_id) c on c.booking_id = b.id
left join (
  select booking_id,
    sum(amount) filter (where kind in ('advance', 'instalment')) as paid,
    sum(amount) filter (where kind = 'refund') as refunded,
    sum(amount) filter (where kind = 'deposit') as deposit_received,
    sum(amount) filter (where kind = 'deposit_refund') as deposit_refunded
  from payments group by booking_id
) p on p.booking_id = b.id;

-- ---------- Dashboard / report function ----------
-- p_basis: 'booking_date' (entry date) or 'event_date'
create or replace function dashboard_stats(p_from date, p_to date, p_hall integer default null, p_basis text default 'booking_date')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  enq_total int; enq_converted int; enq_lost int; enq_open int;
  conf_value numeric; collections numeric; outstanding numeric; dep_held numeric; dep_pending numeric;
  bookings_confirmed int; bookings_tentative int; bookings_cancelled int;
begin
  select count(*), count(*) filter (where status = 'booked'), count(*) filter (where status = 'lost'),
         count(*) filter (where status in ('new', 'follow_up'))
    into enq_total, enq_converted, enq_lost, enq_open
    from enquiries
   where created_at::date between p_from and p_to
     and (p_hall is null or preferred_hall_id = p_hall);

  with bk as (
    select b.*, f.total_payable, f.balance, f.deposit_held, f.paid
      from bookings b join booking_financials f on f.booking_id = b.id
     where (p_hall is null or b.hall_id = p_hall)
       and (case when p_basis = 'event_date' then (b.start_at at time zone 'Asia/Kolkata')::date else b.booking_date end) between p_from and p_to
  )
  select coalesce(sum(total_payable) filter (where status = 'confirmed'), 0),
         coalesce(sum(balance) filter (where status in ('confirmed', 'tentative', 'cancelled') and balance > 0), 0),
         coalesce(sum(deposit_held) filter (where status in ('confirmed', 'tentative')), 0),
         coalesce(sum(deposit_held) filter (where status = 'cancelled' or end_at < now()), 0),
         count(*) filter (where status = 'confirmed'), count(*) filter (where status = 'tentative'), count(*) filter (where status = 'cancelled')
    into conf_value, outstanding, dep_held, dep_pending, bookings_confirmed, bookings_tentative, bookings_cancelled
    from bk;

  select coalesce(sum(case when kind in ('advance', 'instalment') then amount when kind = 'refund' then -amount else 0 end), 0)
    into collections
    from payments p join bookings b on b.id = p.booking_id
   where p.paid_on between p_from and p_to and (p_hall is null or b.hall_id = p_hall);

  return jsonb_build_object(
    'enquiries_total', enq_total, 'enquiries_converted', enq_converted, 'enquiries_lost', enq_lost, 'enquiries_open', enq_open,
    'conversion_pct', case when enq_total = 0 then 0 else round(enq_converted::numeric * 100 / enq_total, 1) end,
    'confirmed_value', conf_value, 'collections', collections, 'outstanding', outstanding,
    'deposits_held', dep_held, 'deposits_refund_pending', dep_pending,
    'bookings_confirmed', bookings_confirmed, 'bookings_tentative', bookings_tentative, 'bookings_cancelled', bookings_cancelled
  );
end $$;

-- Monthly enquiry vs conversion table (same shape as the Mandal's PDF report)
create or replace function monthly_conversion(p_from date, p_to date, p_hall integer default null)
returns table (month date, total_enquiries bigint, confirmed bigint, booked_elsewhere bigint, lost_other bigint, pending bigint, conversion_pct numeric)
language sql stable security definer set search_path = public as $$
  select date_trunc('month', created_at)::date as month,
         count(*) as total_enquiries,
         count(*) filter (where status = 'booked') as confirmed,
         count(*) filter (where status = 'lost' and lost_reason ilike '%elsewhere%') as booked_elsewhere,
         count(*) filter (where status = 'lost' and coalesce(lost_reason, '') not ilike '%elsewhere%') as lost_other,
         count(*) filter (where status in ('new', 'follow_up')) as pending,
         case when count(*) = 0 then 0 else round(count(*) filter (where status = 'booked')::numeric * 100 / count(*), 1) end
    from enquiries
   where created_at::date between p_from and p_to and (p_hall is null or preferred_hall_id = p_hall)
   group by 1 order by 1;
$$;

-- Full data export for manual / scheduled backup (admin only)
create or replace function export_all() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() and auth.role() <> 'service_role' then raise exception 'Admin only'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'version', 1,
    'settings', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from settings s),
    'counters', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from counters c),
    'halls', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from halls h),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from profiles p),
    'enquiries', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from enquiries e),
    'enquiry_followups', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from enquiry_followups f),
    'bookings', (select coalesce(jsonb_agg(to_jsonb(b) - 'slot'), '[]') from bookings b),
    'booking_charges', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from booking_charges c),
    'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from payments p),
    'payment_dues', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from payment_dues d),
    'audit_log', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from audit_log a)
  );
end $$;

-- Restore from an export (admin only). Replaces all business data.
create or replace function restore_all(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  alter table bookings disable trigger audit_bookings;
  alter table payments disable trigger audit_payments;
  alter table booking_charges disable trigger audit_charges;
  alter table enquiries disable trigger audit_enquiries;
  alter table halls disable trigger audit_halls;
  alter table settings disable trigger audit_settings;

  delete from payment_dues; delete from payments; delete from booking_charges;
  update enquiries set converted_booking_id = null;
  delete from bookings; delete from enquiry_followups; delete from enquiries;
  delete from halls; delete from settings; delete from counters;

  insert into settings select * from jsonb_populate_recordset(null::settings, p->'settings');
  insert into counters select * from jsonb_populate_recordset(null::counters, p->'counters');
  insert into halls select * from jsonb_populate_recordset(null::halls, p->'halls');
  insert into enquiries (id, enquiry_no, customer_name, mobile, email, address, preferred_hall_id, event_date, start_time, end_time,
     programme_type, expected_guests, quoted_amount, source, status, lost_reason, next_follow_up, notes, assigned_to, created_by, created_at, updated_at)
    select id, enquiry_no, customer_name, mobile, email, address, preferred_hall_id, event_date, start_time, end_time,
     programme_type, expected_guests, quoted_amount, source, status, lost_reason, next_follow_up, notes, assigned_to, created_by, created_at, updated_at
    from jsonb_populate_recordset(null::enquiries, p->'enquiries');
  insert into enquiry_followups select * from jsonb_populate_recordset(null::enquiry_followups, p->'enquiry_followups');
  insert into bookings (id, booking_no, booking_date, enquiry_id, hall_id, customer_name, mobile, email, address, member_no, programme_type,
     expected_guests, start_at, end_at, buffer_minutes, status, tentative_expires_at, hall_charges, member_discount, gst_rate, deposit_amount,
     cancelled_at, cancellation_reason, cancellation_charge, rescheduled_from_id, original_start_at, original_end_at, terms_accepted, notes, created_by, created_at, updated_at)
    select id, booking_no, booking_date, enquiry_id, hall_id, customer_name, mobile, email, address, member_no, programme_type,
     expected_guests, start_at, end_at, buffer_minutes, status, tentative_expires_at, hall_charges, member_discount, gst_rate, deposit_amount,
     cancelled_at, cancellation_reason, cancellation_charge, rescheduled_from_id, original_start_at, original_end_at, terms_accepted, notes, created_by, created_at, updated_at
    from jsonb_populate_recordset(null::bookings, p->'bookings');
  update enquiries e set converted_booking_id = (x->>'converted_booking_id')::int
    from jsonb_array_elements(p->'enquiries') x where e.id = (x->>'id')::int and x->>'converted_booking_id' is not null;
  insert into booking_charges select * from jsonb_populate_recordset(null::booking_charges, p->'booking_charges');
  insert into payments select * from jsonb_populate_recordset(null::payments, p->'payments');
  insert into payment_dues select * from jsonb_populate_recordset(null::payment_dues, p->'payment_dues');

  perform setval('enquiries_id_seq', coalesce((select max(id) from enquiries), 0) + 1, false);
  perform setval('enquiry_followups_id_seq', coalesce((select max(id) from enquiry_followups), 0) + 1, false);
  perform setval('bookings_id_seq', coalesce((select max(id) from bookings), 0) + 1, false);
  perform setval('booking_charges_id_seq', coalesce((select max(id) from booking_charges), 0) + 1, false);
  perform setval('payments_id_seq', coalesce((select max(id) from payments), 0) + 1, false);
  perform setval('payment_dues_id_seq', coalesce((select max(id) from payment_dues), 0) + 1, false);
  perform setval('halls_id_seq', coalesce((select max(id) from halls), 0) + 1, false);

  alter table bookings enable trigger audit_bookings;
  alter table payments enable trigger audit_payments;
  alter table booking_charges enable trigger audit_charges;
  alter table enquiries enable trigger audit_enquiries;
  alter table halls enable trigger audit_halls;
  alter table settings enable trigger audit_settings;
  insert into audit_log (table_name, record_id, action, changed_by) values ('system', 'restore', 'restore', auth.uid());
end $$;

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table settings enable row level security;
alter table counters enable row level security;
alter table halls enable row level security;
alter table enquiries enable row level security;
alter table enquiry_followups enable row level security;
alter table bookings enable row level security;
alter table booking_charges enable row level security;
alter table payments enable row level security;
alter table payment_dues enable row level security;
alter table audit_log enable row level security;

-- profiles
create policy "profiles read" on profiles for select to authenticated using (is_staff());
create policy "profiles self update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy "profiles admin all" on profiles for all to authenticated using (is_admin()) with check (is_admin());

-- settings / counters / halls
create policy "settings read" on settings for select to authenticated using (is_staff());
create policy "settings admin" on settings for all to authenticated using (is_admin()) with check (is_admin());
create policy "counters read" on counters for select to authenticated using (is_staff());
create policy "counters admin" on counters for all to authenticated using (is_admin()) with check (is_admin());
create policy "halls read" on halls for select to authenticated using (is_staff());
create policy "halls admin" on halls for all to authenticated using (is_admin()) with check (is_admin());

-- enquiries: all staff can read/create/update; only admin deletes
create policy "enquiries read" on enquiries for select to authenticated using (is_staff());
create policy "enquiries insert" on enquiries for insert to authenticated with check (is_staff());
create policy "enquiries update" on enquiries for update to authenticated using (is_staff()) with check (is_staff());
create policy "enquiries delete" on enquiries for delete to authenticated using (is_admin());
create policy "followups read" on enquiry_followups for select to authenticated using (is_staff());
create policy "followups insert" on enquiry_followups for insert to authenticated with check (is_staff());

-- bookings: all staff read/create/update (discount & cancellation guarded by trigger); admin deletes
create policy "bookings read" on bookings for select to authenticated using (is_staff());
create policy "bookings insert" on bookings for insert to authenticated with check (is_staff());
create policy "bookings update" on bookings for update to authenticated using (is_staff()) with check (is_staff());
create policy "bookings delete" on bookings for delete to authenticated using (is_admin());
create policy "charges read" on booking_charges for select to authenticated using (is_staff());
create policy "charges insert" on booking_charges for insert to authenticated with check (is_staff());
create policy "charges modify" on booking_charges for update to authenticated using (is_accounts()) with check (is_accounts());
create policy "charges delete" on booking_charges for delete to authenticated using (is_accounts());

-- payments: everyone reads, only accounts/admin write
create policy "payments read" on payments for select to authenticated using (is_staff());
create policy "payments write" on payments for insert to authenticated with check (is_accounts());
create policy "payments update" on payments for update to authenticated using (is_accounts()) with check (is_accounts());
create policy "payments delete" on payments for delete to authenticated using (is_admin());
create policy "dues read" on payment_dues for select to authenticated using (is_staff());
create policy "dues write" on payment_dues for all to authenticated using (is_accounts()) with check (is_accounts());

-- audit log: accounts/admin read only; written by security-definer triggers
create policy "audit read" on audit_log for select to authenticated using (is_accounts());

-- booking_financials view runs with invoker's rights -> inherits bookings RLS
alter view booking_financials set (security_invoker = true);

-- ---------- Storage bucket for backups (private) ----------
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict do nothing;
create policy "backups admin read" on storage.objects for select to authenticated using (bucket_id = 'backups' and is_admin());
create policy "backups admin write" on storage.objects for insert to authenticated with check (bucket_id = 'backups' and is_admin());
create policy "backups admin delete" on storage.objects for delete to authenticated using (bucket_id = 'backups' and is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table bookings, enquiries, payments;
