-- =====================================================================
-- Migration 0004: month-by-month report series used by charts, Excel and PDF.
-- Run once in Supabase SQL Editor.
-- =====================================================================

create or replace function monthly_report(p_from date, p_to date, p_hall integer default null)
returns table (
  month date,
  enquiries bigint,
  converted bigint,
  lost bigint,
  bookings_confirmed bigint,
  bookings_cancelled bigint,
  confirmed_value numeric,
  collections numeric,
  events_held bigint
)
language sql stable security definer set search_path = public as $$
  with months as (
    select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date as month
  ),
  e as (
    select date_trunc('month', created_at)::date as month,
           count(*) as enquiries,
           count(*) filter (where status = 'booked') as converted,
           count(*) filter (where status = 'lost') as lost
      from enquiries
     where created_at::date between p_from and p_to and (p_hall is null or preferred_hall_id = p_hall)
     group by 1
  ),
  b as (
    select date_trunc('month', bk.booking_date)::date as month,
           count(*) filter (where bk.status = 'confirmed') as bookings_confirmed,
           count(*) filter (where bk.status = 'cancelled') as bookings_cancelled,
           coalesce(sum(f.total_payable) filter (where bk.status = 'confirmed'), 0) as confirmed_value
      from bookings bk join booking_financials f on f.booking_id = bk.id
     where bk.booking_date between p_from and p_to and (p_hall is null or bk.hall_id = p_hall)
     group by 1
  ),
  ev as (
    select date_trunc('month', (start_at at time zone 'Asia/Kolkata'))::date as month, count(*) as events_held
      from bookings
     where status = 'confirmed' and (start_at at time zone 'Asia/Kolkata')::date between p_from and p_to
       and (p_hall is null or hall_id = p_hall)
     group by 1
  ),
  p as (
    select date_trunc('month', pm.paid_on)::date as month,
           coalesce(sum(case when pm.kind in ('advance', 'instalment') then pm.amount when pm.kind = 'refund' then -pm.amount else 0 end), 0) as collections
      from payments pm join bookings bk on bk.id = pm.booking_id
     where pm.paid_on between p_from and p_to and (p_hall is null or bk.hall_id = p_hall)
     group by 1
  )
  select m.month,
         coalesce(e.enquiries, 0), coalesce(e.converted, 0), coalesce(e.lost, 0),
         coalesce(b.bookings_confirmed, 0), coalesce(b.bookings_cancelled, 0), coalesce(b.confirmed_value, 0),
         coalesce(p.collections, 0), coalesce(ev.events_held, 0)
    from months m
    left join e on e.month = m.month
    left join b on b.month = m.month
    left join p on p.month = m.month
    left join ev on ev.month = m.month
   order by m.month;
$$;
