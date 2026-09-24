-- Standalone "Boost" purchase: a cheap, time-boxed visibility lift, bought as
-- a credit pack and manually activated by the user. Independent of premium —
-- both free and premium members can buy and use it.
--
-- Reuses the existing pricing_plans/payments/Paystack pipeline rather than
-- building a parallel one: pricing_plans gets a `kind` discriminator so
-- complete_payment() can tell a boost purchase apart from a subscription
-- purchase and credit the right thing. Neither paystack-charge nor
-- paystack-webhook needs to change — both are already generic over plan_id.

-- 1. Plan catalogue: a boost SKU alongside the subscription plans -------------

alter table public.pricing_plans
  add column if not exists kind text not null default 'subscription'
    check (kind in ('subscription', 'boost')),
  add column if not exists boost_credits integer null
    check (boost_credits is null or boost_credits > 0);

-- duration_days = 1 is a dummy value that only satisfies the pre-existing
-- `check (duration_days > 0)` constraint. Boosts are not day-based and this
-- column is never read on the boost activation path (see complete_payment
-- below) — do not "fix" it to a real day count.
insert into public.pricing_plans (plan_id, label, duration_days, price_ksh, sort_order, kind, boost_credits)
values ('boost_pack_2', 'Boost Pack', 1, 59, 100, 'boost', 2)
on conflict (plan_id) do update
  set label = excluded.label,
      price_ksh = excluded.price_ksh,
      kind = excluded.kind,
      boost_credits = excluded.boost_credits,
      is_active = true;

-- 2. Profile-side credit balance and active-boost timestamp -------------------

alter table public.profiles
  add column if not exists boost_credits integer not null default 0
    check (boost_credits >= 0),
  add column if not exists boost_active_until timestamptz null;

-- boost_active_until is never reset to null when a boost expires — every
-- reader (get_gallery_profiles below, the frontend countdown) must treat "in
-- the past" as "no boost active," never rely on IS NULL. This keeps expiry a
-- pure live timestamp comparison with no cron job involved.

-- The guard trigger must name the new columns, otherwise profiles_update_self
-- (auth_user_id = auth.uid(), no column restriction) lets a signed-in user
-- grant themselves boost credits directly, the same hole this trigger already
-- closes for is_premium/premium_expires_at/etc.
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
      or new.payment_reference is distinct from old.payment_reference
      or new.boost_credits is distinct from old.boost_credits
      or new.boost_active_until is distinct from old.boost_active_until
    )
  then
    raise exception 'plan_fields_require_payment';
  end if;

  return new;
end;
$$;

-- Trigger definition (profiles_protect_plan_fields) already points at this
-- function by name, so no re-creation of the trigger itself is needed.

-- 3. complete_payment(): branch on pricing_plans.kind --------------------------

-- The webhook always calls this one RPC name regardless of what was bought
-- (paystack-webhook/index.ts never reads plan_id itself), so routing a boost
-- purchase to different activation logic happens here rather than by adding a
-- second RPC — that keeps the row-lock/idempotency choke point on `payments`
-- singular instead of duplicating it, and requires zero edge function changes.
create or replace function public.complete_payment(
  p_reference text,
  p_provider_receipt text,
  p_provider_transaction_id text,
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
  where reference = p_reference
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

  -- Paystack reports what was actually settled. Anything short of the plan price
  -- is recorded but never activated.
  if p_paid_amount is null or p_paid_amount < v_plan.price_ksh then
    update public.payments
    set status = 'amount_mismatch',
        paid_amount = p_paid_amount,
        provider_receipt = p_provider_receipt,
        provider_transaction_id = p_provider_transaction_id,
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
      provider_receipt = p_provider_receipt,
      provider_transaction_id = p_provider_transaction_id,
      result_desc = p_result_desc,
      completed_at = v_now,
      updated_at = v_now
  where id = v_payment.id;

  if v_plan.kind = 'boost' then
    -- Atomic increment: no read-then-write race, unlike the subscription
    -- branch's separate SELECT + greatest() below (which needs the current
    -- expiry to stack onto, so it can't be a single UPDATE).
    update public.profiles
    set boost_credits = boost_credits + coalesce(v_plan.boost_credits, 0)
    where id = v_payment.profile_id;
  else
    -- Renewing early stacks onto the remaining time instead of discarding it.
    select greatest(coalesce(p.premium_expires_at, v_now), v_now)
    into v_base
    from public.profiles p
    where p.id = v_payment.profile_id;

    update public.profiles
    set is_premium = true,
        subscription_plan = v_plan.plan_id,
        premium_expires_at = v_base + make_interval(days => v_plan.duration_days),
        payment_reference = coalesce(p_provider_receipt, p_reference)
    where id = v_payment.profile_id;
  end if;

  return 'activated';
end;
$$;

-- 4. activate_boost(): the one payment-adjacent RPC a signed-in user calls directly -

-- Redeems one purchased credit for 30 minutes of active boost. Unlike
-- complete_payment/fail_payment (service_role only, driven by the webhook),
-- this is user-triggered: granted to `authenticated`, ownership-checked via
-- current_profile_id(), and it never touches payments — it only spends a
-- credit that a completed boost purchase already granted.
create or replace function public.activate_boost()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_now timestamptz := timezone('utc', now());
  v_credits integer;
  v_until timestamptz;
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  select boost_credits, boost_active_until
  into v_credits, v_until
  from public.profiles
  where id = v_profile_id
  for update;

  if v_until is not null and v_until > v_now then
    return 'already_active';
  end if;

  if coalesce(v_credits, 0) <= 0 then
    return 'no_credits';
  end if;

  update public.profiles
  set boost_credits = boost_credits - 1,
      boost_active_until = v_now + interval '30 minutes'
  where id = v_profile_id;

  return 'activated';
end;
$$;

revoke execute on function public.activate_boost() from public;
revoke execute on function public.activate_boost() from anon;
grant execute on function public.activate_boost() to authenticated;

-- 5. get_gallery_profiles(): boost raises a candidate's sampling weight -------

-- Same signature and same "re-serve the pinned profile" fast path as before
-- (that path never used score/freshness, so it needs no boost logic); only
-- the eligible/candidates CTEs in the fresh-candidate path change.
drop function if exists public.get_gallery_profiles(integer);

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
  photo_url text,
  alignment_reasons text[]
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

  -- The profile already on screen is re-served without spending another view,
  -- so a refresh is free.
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
      and public.is_mutually_eligible(me.id, p.id)
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
    fp.public_url as photo_url,
    public.compatibility_reasons(v_profile_id, p.id) as alignment_reasons
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
  eligible as (
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
      fp.public_url as photo_url,
      -- Someone who already liked you is the strongest signal available: it
      -- converts to a match on your next swipe.
      exists (
        select 1
        from public.swipes liked
        where liked.actor_profile_id = p.id
          and liked.target_profile_id = me.id
          and liked.direction = 'like'
      ) as liked_me,
      public.compatibility_score(me.id, p.id) as score,
      -- A small, temporary lift so new members are not invisible on arrival.
      case when p.created_at >= now() - interval '7 days' then 1.25 else 1.0 end as freshness,
      -- A larger, temporary lift while the CANDIDATE (p) has a purchased boost
      -- running. Live timestamp comparison, no cron: once boost_active_until
      -- is in the past this naturally reads back 1.0 on the very next call.
      case when p.boost_active_until > now() then 3.0 else 1.0 end as boost_multiplier
    from public.profiles p
    left join first_photos fp on fp.profile_id = p.id
    cross join me
    where p.id <> me.id
      and p.profile_ready = true
      and public.is_mutually_eligible(me.id, p.id)
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
  ),
  -- Ordering sits in its own level because ORDER BY cannot reference an output
  -- alias from inside an expression; here score/freshness/boost_multiplier are
  -- input columns, so each is computed once per candidate rather than twice.
  --
  -- Reciprocity first, then sampling weighted by compatibility * freshness *
  -- boost (Efraimidis-Spirakis). Sampling rather than a strict ranking keeps
  -- the same few faces from being shown to everybody and lets the tail
  -- surface. Because liked_me is evaluated first, a boosted-but-unreciprocated
  -- candidate can never outrank someone who already liked the viewer, no
  -- matter how large boost_multiplier is.
  candidates as (
    select eligible.*
    from eligible
    order by
      eligible.liked_me desc,
      -ln(random()) / greatest(eligible.score * eligible.freshness * eligible.boost_multiplier, 0.01)
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
    candidates.photo_url,
    public.compatibility_reasons(v_profile_id, candidates.id) as alignment_reasons
  from candidates
  join recorded on recorded.target_profile_id = candidates.id;
end;
$$;

-- The preceding drop+create resets the function to default privileges, so the
-- grant has to be reasserted exactly as the original migration set it up.
revoke execute on function public.get_gallery_profiles(integer) from public;
revoke execute on function public.get_gallery_profiles(integer) from anon;
grant execute on function public.get_gallery_profiles(integer) to authenticated;
