-- Close the paywall bypasses and make payment activation server-authoritative.
--
-- Before this migration a signed-in user could reach premium four ways:
--   1. call public.unlock_premium_after_payment() directly (no payment check),
--   2. post any amount/profile_id to the stk-push edge function,
--   3. forge an M-Pesa success callback,
--   4. read every profile straight from the table, ignoring the view limit.
--
-- Plan prices now live in the database, activation happens only through a
-- service_role-only function, and profile reads go through the gallery RPC.

-- 1. Server-side plan catalogue -----------------------------------------------

create table if not exists public.pricing_plans (
  plan_id text primary key,
  label text not null,
  duration_days integer not null check (duration_days > 0),
  price_ksh integer not null check (price_ksh > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.pricing_plans (plan_id, label, duration_days, price_ksh, sort_order)
values
  ('7_days', '7-Day Trial', 7, 99, 1),
  ('30_days', '30-Day Pass', 30, 199, 2),
  ('90_days', '90-Day Pass', 90, 499, 3),
  ('180_days', '180-Day Pass', 180, 999, 4),
  ('365_days', 'Annual Pass', 365, 1799, 5)
on conflict (plan_id) do update
  set label = excluded.label,
      duration_days = excluded.duration_days,
      price_ksh = excluded.price_ksh,
      sort_order = excluded.sort_order,
      is_active = true;

alter table public.pricing_plans enable row level security;

-- Prices are public information; writes are service_role only (RLS default deny).
drop policy if exists "pricing_plans_read" on public.pricing_plans;
create policy "pricing_plans_read"
on public.pricing_plans
for select
to anon, authenticated
using (is_active = true);

-- 2. Premium must respect its expiry date -------------------------------------

-- is_premium alone stayed true forever once set. Every paywall check now goes
-- through this helper so an elapsed subscription actually closes the gate.
create or replace function public.has_active_premium(p_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_premium
        and (p.premium_expires_at is null or p.premium_expires_at > timezone('utc', now()))
      from public.profiles p
      where p.id = p_profile_id
    ),
    false
  );
$$;

revoke execute on function public.has_active_premium(uuid) from public;
grant execute on function public.has_active_premium(uuid) to authenticated, service_role;

-- 3. Remove the free-premium back doors ---------------------------------------

drop function if exists public.unlock_premium_after_payment();

-- The original trigger guarded is_premium and daily_swipe_limit only, so a
-- member who had paid once could push premium_expires_at out indefinitely.
create or replace function public.protect_profile_plan_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.is_premium is distinct from old.is_premium
      or new.daily_swipe_limit is distinct from old.daily_swipe_limit
      or new.subscription_plan is distinct from old.subscription_plan
      or new.premium_expires_at is distinct from old.premium_expires_at
      or new.mpesa_receipt_number is distinct from old.mpesa_receipt_number
    )
  then
    raise exception 'plan_fields_require_payment';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_plan_fields on public.profiles;
create trigger profiles_protect_plan_fields
before update on public.profiles
for each row
execute function public.protect_profile_plan_fields();

-- 4. Payment records ----------------------------------------------------------

alter table public.payments
  add column if not exists paid_amount numeric null,
  add column if not exists completed_at timestamptz null;

create index if not exists payments_profile_created_at_idx
on public.payments (profile_id, created_at desc);

-- Only the owner may read their payments; all writes go through service_role.
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments
for select
to authenticated
using (profile_id = public.current_profile_id());

-- Activation is idempotent and verifies the amount against the plan price, so a
-- replayed or forged callback cannot extend a subscription for free.
create or replace function public.complete_mpesa_payment(
  p_checkout_request_id text,
  p_mpesa_receipt text,
  p_result_desc text,
  p_paid_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_plan public.pricing_plans%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_base timestamptz;
begin
  select * into v_payment
  from public.payments
  where checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_payment.status = 'completed' then
    return 'already_completed';
  end if;

  select * into v_plan
  from public.pricing_plans
  where plan_id = v_payment.plan_id;

  if not found then
    update public.payments
    set status = 'failed',
        result_desc = 'Unknown plan: ' || coalesce(v_payment.plan_id, '(null)'),
        updated_at = v_now
    where id = v_payment.id;

    return 'unknown_plan';
  end if;

  -- Daraja echoes back what was actually paid. Anything short of the plan price
  -- is recorded but never activated.
  if p_paid_amount is null or p_paid_amount < v_plan.price_ksh then
    update public.payments
    set status = 'amount_mismatch',
        paid_amount = p_paid_amount,
        mpesa_receipt = p_mpesa_receipt,
        result_desc = format(
          'Paid %s but plan %s costs %s',
          coalesce(p_paid_amount::text, 'nothing'),
          v_plan.plan_id,
          v_plan.price_ksh
        ),
        updated_at = v_now
    where id = v_payment.id;

    return 'amount_mismatch';
  end if;

  update public.payments
  set status = 'completed',
      paid_amount = p_paid_amount,
      mpesa_receipt = p_mpesa_receipt,
      result_desc = p_result_desc,
      completed_at = v_now,
      updated_at = v_now
  where id = v_payment.id;

  -- Renewing early stacks onto the remaining time instead of discarding it.
  select greatest(coalesce(p.premium_expires_at, v_now), v_now)
  into v_base
  from public.profiles p
  where p.id = v_payment.profile_id;

  update public.profiles
  set is_premium = true,
      subscription_plan = v_plan.plan_id,
      premium_expires_at = v_base + make_interval(days => v_plan.duration_days),
      mpesa_receipt_number = p_mpesa_receipt
  where id = v_payment.profile_id;

  return 'activated';
end;
$$;

create or replace function public.fail_mpesa_payment(
  p_checkout_request_id text,
  p_result_desc text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment
  from public.payments
  where checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return 'not_found';
  end if;

  -- Never walk back a completed payment.
  if v_payment.status = 'completed' then
    return 'already_completed';
  end if;

  update public.payments
  set status = 'failed',
      result_desc = p_result_desc,
      updated_at = timezone('utc', now())
  where id = v_payment.id;

  return 'failed';
end;
$$;

-- These are the activation path: only the callback (service_role) may call them.
revoke execute on function public.complete_mpesa_payment(text, text, text, numeric) from public;
revoke execute on function public.complete_mpesa_payment(text, text, text, numeric) from anon, authenticated;
revoke execute on function public.fail_mpesa_payment(text, text) from public;
revoke execute on function public.fail_mpesa_payment(text, text) from anon, authenticated;
grant execute on function public.complete_mpesa_payment(text, text, text, numeric) to service_role;
grant execute on function public.fail_mpesa_payment(text, text) to service_role;

-- 5. Close the direct-read bypass of the view limit ---------------------------

-- Other members' profiles and photos are reachable only through
-- get_gallery_profiles()/get_matches(), which meter and record each view.
-- Drop both names: the old one on a database that predates this migration, and
-- the new one so re-running is safe (create policy has no "or replace").
drop policy if exists "profiles_select_visible" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "profile_photos_select_visible" on public.profile_photos;
drop policy if exists "profile_photos_select_own" on public.profile_photos;
create policy "profile_photos_select_own"
on public.profile_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_photos.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- 6. Re-point the paywall checks at has_active_premium ------------------------

-- Gates Parlor chat as well as the gallery. The previous version selected from
-- profiles, so a missing profile yielded NULL, which `if ... then` reads as
-- "not locked". This form always returns one row and fails closed.
create or replace function public.is_profile_view_locked(p_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    not public.has_active_premium(p_profile_id)
      and (
        select count(*) >= coalesce(
          (select p.daily_swipe_limit from public.profiles p where p.id = p_profile_id),
          5
        )
        from public.profile_views pv
        where pv.viewer_profile_id = p_profile_id
          and pv.viewed_at >= now() - interval '24 hours'
      ),
    true
  );
$$;

create or replace function public.get_profile_view_status()
returns table (
  used_views integer,
  remaining_views integer,
  is_locked boolean,
  locked_until timestamptz,
  payment_amount_ksh integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_is_premium boolean;
  v_limit integer;
  v_used integer;
  v_locked_until timestamptz;
  v_entry_price integer;
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  v_is_premium := public.has_active_premium(v_profile_id);

  select daily_swipe_limit
  into v_limit
  from public.profiles p
  where p.id = v_profile_id;

  select count(*), min(viewed_at) + interval '24 hours'
  into v_used, v_locked_until
  from public.profile_views
  where viewer_profile_id = v_profile_id
    and viewed_at >= now() - interval '24 hours';

  -- The prompt quotes the cheapest live plan rather than a hardcoded figure.
  select min(price_ksh)
  into v_entry_price
  from public.pricing_plans
  where is_active = true;

  return query
  select
    coalesce(v_used, 0),
    case
      when v_is_premium then coalesce(v_limit, 5)
      else greatest(0, coalesce(v_limit, 5) - coalesce(v_used, 0))
    end,
    not v_is_premium and coalesce(v_used, 0) >= coalesce(v_limit, 5),
    case
      when not v_is_premium and coalesce(v_used, 0) >= coalesce(v_limit, 5) then v_locked_until
      else null
    end,
    coalesce(v_entry_price, 99);
end;
$$;

create or replace function public.get_gallery_profiles(limit_count integer default 20)
returns table (
  id uuid,
  name text,
  age integer,
  gender public.gender_type,
  location text,
  boundary text,
  intent text,
  core_value text,
  why_niwangu text,
  photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_is_premium boolean;
  v_limit integer;
  v_used integer;
  v_remaining integer;
  v_take integer := 1;
  v_returned integer;
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_profile_id::text, 0));

  v_is_premium := public.has_active_premium(v_profile_id);

  select daily_swipe_limit
  into v_limit
  from public.profiles p
  where p.id = v_profile_id;

  v_limit := coalesce(v_limit, 5);

  return query
  with me as (
    select profile_me.*
    from public.profiles profile_me
    where profile_me.id = v_profile_id
  ),
  first_photos as (
    select distinct on (profile_id)
      profile_id,
      public_url
    from public.profile_photos
    order by profile_id, sort_order asc
  ),
  current_view as (
    select pv.target_profile_id
    from public.profile_views pv
    join me on me.id = pv.viewer_profile_id
    join public.profiles p on p.id = pv.target_profile_id
    where p.profile_ready = true
      and (me.seeking_gender is null or p.gender = me.seeking_gender)
      and not exists (
        select 1
        from public.swipes s
        where s.actor_profile_id = me.id
          and s.target_profile_id = p.id
      )
      and not exists (
        select 1
        from public.matches m
        where p.id in (m.profile_low_id, m.profile_high_id)
          and me.id in (m.profile_low_id, m.profile_high_id)
      )
    order by pv.viewed_at desc
    limit 1
  )
  select
    p.id,
    p.full_name as name,
    p.age,
    p.gender,
    p.location,
    p.boundary,
    p.intent,
    p.core_value,
    p.why_niwangu,
    fp.public_url as photo_url
  from current_view cv
  join public.profiles p on p.id = cv.target_profile_id
  left join first_photos fp on fp.profile_id = p.id;

  get diagnostics v_returned = row_count;
  if v_returned > 0 then
    return;
  end if;

  select count(*)
  into v_used
  from public.profile_views
  where viewer_profile_id = v_profile_id
    and viewed_at >= now() - interval '24 hours';

  v_remaining := greatest(0, v_limit - coalesce(v_used, 0));

  if not v_is_premium and v_remaining <= 0 then
    return;
  end if;

  return query
  with me as (
    select profile_me.*
    from public.profiles profile_me
    where profile_me.id = v_profile_id
  ),
  first_photos as (
    select distinct on (profile_id)
      profile_id,
      public_url
    from public.profile_photos
    order by profile_id, sort_order asc
  ),
  candidates as (
    select
      p.id,
      p.full_name as name,
      p.age,
      p.gender,
      p.location,
      p.boundary,
      p.intent,
      p.core_value,
      p.why_niwangu,
      fp.public_url as photo_url
    from public.profiles p
    left join first_photos fp on fp.profile_id = p.id
    cross join me
    where p.id <> me.id
      and p.profile_ready = true
      and (me.seeking_gender is null or p.gender = me.seeking_gender)
      and not exists (
        select 1
        from public.swipes s
        where s.actor_profile_id = me.id
          and s.target_profile_id = p.id
      )
      and not exists (
        select 1
        from public.matches m
        where p.id in (m.profile_low_id, m.profile_high_id)
          and me.id in (m.profile_low_id, m.profile_high_id)
      )
      and not exists (
        select 1
        from public.profile_views pv
        where pv.viewer_profile_id = me.id
          and pv.target_profile_id = p.id
      )
    order by random()
    limit v_take
  ),
  recorded as (
    insert into public.profile_views (viewer_profile_id, target_profile_id, viewed_at)
    select v_profile_id, candidates.id, now()
    from candidates
    on conflict (viewer_profile_id, target_profile_id) do update
      set viewed_at = excluded.viewed_at
      where public.profile_views.viewed_at < now() - interval '24 hours'
    returning target_profile_id
  )
  select
    candidates.id,
    candidates.name,
    candidates.age,
    candidates.gender,
    candidates.location,
    candidates.boundary,
    candidates.intent,
    candidates.core_value,
    candidates.why_niwangu,
    candidates.photo_url
  from candidates
  join recorded on recorded.target_profile_id = candidates.id;
end;
$$;

create or replace function public.handle_swipe(
  p_target_profile_id uuid,
  p_direction public.swipe_direction
)
returns table (
  matched boolean,
  match_id uuid,
  remaining_swipes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := public.current_profile_id();
  v_is_premium boolean;
  v_daily_limit integer;
  v_view_count integer;
  v_target_was_viewed boolean;
  v_new_match_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_profile_id is null or p_target_profile_id = v_actor_profile_id then
    raise exception 'Invalid swipe target';
  end if;

  v_is_premium := public.has_active_premium(v_actor_profile_id);

  select daily_swipe_limit
  into v_daily_limit
  from public.profiles p
  where p.id = v_actor_profile_id;

  v_daily_limit := coalesce(v_daily_limit, 5);

  select exists (
    select 1
    from public.profile_views
    where viewer_profile_id = v_actor_profile_id
      and target_profile_id = p_target_profile_id
      and viewed_at >= now() - interval '24 hours'
  )
  into v_target_was_viewed;

  if not v_is_premium and not v_target_was_viewed then
    select count(*)
    into v_view_count
    from public.profile_views
    where viewer_profile_id = v_actor_profile_id
      and viewed_at >= now() - interval '24 hours';

    if v_view_count >= v_daily_limit then
      raise exception 'profile_view_limit_reached';
    end if;

    insert into public.profile_views (viewer_profile_id, target_profile_id, viewed_at)
    values (v_actor_profile_id, p_target_profile_id, now())
    on conflict (viewer_profile_id, target_profile_id) do update
      set viewed_at = excluded.viewed_at
      where public.profile_views.viewed_at < now() - interval '24 hours';
  end if;

  insert into public.swipes (actor_profile_id, target_profile_id, direction)
  values (v_actor_profile_id, p_target_profile_id, p_direction)
  on conflict (actor_profile_id, target_profile_id) do update
    set direction = excluded.direction;

  if p_direction = 'like' and exists (
      select 1
      from public.swipes reverse_swipe
      where reverse_swipe.actor_profile_id = p_target_profile_id
        and reverse_swipe.target_profile_id = v_actor_profile_id
        and reverse_swipe.direction = 'like'
  ) then
    insert into public.matches (profile_low_id, profile_high_id)
    values (least(v_actor_profile_id, p_target_profile_id), greatest(v_actor_profile_id, p_target_profile_id))
    on conflict (profile_low_id, profile_high_id) do nothing
    returning id into v_new_match_id;

    if v_new_match_id is null then
      select m.id
      into v_new_match_id
      from public.matches m
      where m.profile_low_id = least(v_actor_profile_id, p_target_profile_id)
        and m.profile_high_id = greatest(v_actor_profile_id, p_target_profile_id);
    end if;
  end if;

  select count(*)
  into v_view_count
  from public.profile_views
  where viewer_profile_id = v_actor_profile_id
    and viewed_at >= now() - interval '24 hours';

  return query
  select
    v_new_match_id is not null,
    v_new_match_id,
    case
      when v_is_premium then v_daily_limit
      else greatest(0, v_daily_limit - coalesce(v_view_count, 0))
    end;
end;
$$;

revoke execute on function public.get_profile_view_status() from public;
revoke execute on function public.get_gallery_profiles(integer) from public;
revoke execute on function public.handle_swipe(uuid, public.swipe_direction) from public;

grant execute on function public.get_profile_view_status() to authenticated;
grant execute on function public.get_gallery_profiles(integer) to authenticated;
grant execute on function public.handle_swipe(uuid, public.swipe_direction) to authenticated;
