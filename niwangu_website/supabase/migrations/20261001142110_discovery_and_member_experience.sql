-- Ten decisions per Africa/Nairobi calendar day. Browsing never consumes a decision.
alter table public.profiles alter column daily_swipe_limit set default 10;
update public.profiles set daily_swipe_limit = 10;
alter table public.profiles add column if not exists discovery_paused boolean not null default false;
create table public.member_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 min_age integer not null default 18 check(min_age >= 18),
 max_age integer not null default 100 check(max_age >= min_age and max_age <= 120),
 town text not null default '', intent text not null default '', core_value text not null default '',
 incognito boolean not null default false, notify_matches boolean not null default true,
 notify_messages boolean not null default true
);
create table public.member_blocks (
 profile_id uuid references public.profiles(id) on delete cascade,
 target_profile_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(profile_id,target_profile_id),
 check(profile_id <> target_profile_id)
);
create table public.member_reports (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 target_profile_id uuid references public.profiles(id) on delete set null,
 reason text not null check(length(trim(reason)) between 5 and 2000),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved')),
 created_at timestamptz not null default now()
);
create table public.saved_profiles (
 profile_id uuid references public.profiles(id) on delete cascade,
 target_profile_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(profile_id,target_profile_id),
 check(profile_id <> target_profile_id)
);
-- Immutable decision ledger: undo never refunds allowance.
create table public.member_decisions (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 target_profile_id uuid references public.profiles(id) on delete set null,
 direction public.swipe_direction not null, created_at timestamptz not null default now()
);
create index member_decisions_daily on public.member_decisions(profile_id,created_at);
create index swipes_incoming_likes on public.swipes(target_profile_id,direction);
create index member_blocks_target on public.member_blocks(target_profile_id);
alter table public.member_preferences enable row level security;
create policy "member_preferences_own_read" on public.member_preferences for select to authenticated using(profile_id=public.current_profile_id());
grant select on public.member_preferences to authenticated;
alter table public.member_blocks enable row level security;
create policy "member_blocks_own_read" on public.member_blocks for select to authenticated using(profile_id=public.current_profile_id());
grant select on public.member_blocks to authenticated;
alter table public.member_reports enable row level security;
create policy "member_reports_own_read" on public.member_reports for select to authenticated using(profile_id=public.current_profile_id());
grant select on public.member_reports to authenticated;
alter table public.saved_profiles enable row level security;
create policy "saved_profiles_own_read" on public.saved_profiles for select to authenticated using(profile_id=public.current_profile_id());
grant select on public.saved_profiles to authenticated;
alter table public.member_decisions enable row level security;
create policy "member_decisions_own_read" on public.member_decisions for select to authenticated using(profile_id=public.current_profile_id());
grant select on public.member_decisions to authenticated;
create policy "member_preferences_own_write" on public.member_preferences for all to authenticated using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());
grant insert,update,delete on public.member_preferences to authenticated;
create policy "saved_profiles_own_write" on public.saved_profiles for all to authenticated using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());
grant insert,update,delete on public.saved_profiles to authenticated;

-- Reports and blocks are written only through ownership-checked RPCs.
create or replace function public.members_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.member_blocks where (profile_id=p_a and target_profile_id=p_b) or (profile_id=p_b and target_profile_id=p_a));
$$;
create or replace function public.get_profile_view_status()
returns table(used_views integer,remaining_views integer,is_locked boolean,locked_until timestamptz,payment_amount_ksh integer)
language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id(); used integer; premium boolean; reset_at timestamptz;
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 premium:=public.has_active_premium(actor);
 reset_at:=((now() at time zone 'Africa/Nairobi')::date + 1)::timestamp at time zone 'Africa/Nairobi';
 select count(*) into used from public.member_decisions where profile_id=actor
 and created_at >= ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi';
 return query select used,case when premium then 2147483647 else greatest(0,10-used) end,
 not premium and used>=10,reset_at,coalesce((select min(price_ksh) from public.pricing_plans where is_active and kind='subscription'),99);
end; $$;
create or replace function public.is_profile_view_locked(p_profile_id uuid default public.current_profile_id())
returns boolean language sql stable security definer set search_path=public as $$
 select not public.has_active_premium(p_profile_id) and
 (select count(*) from public.member_decisions where profile_id=p_profile_id and created_at >=
 ((now() at time zone 'Africa/Nairobi')::date)::timestamp at time zone 'Africa/Nairobi') >= 10;
$$;
-- Reads are bounded and deterministic. Filters and visibility are enforced here, not just in React.
create or replace function public.get_discovery_profiles(p_section text default 'discover',p_offset integer default 0,p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender_type,location text,boundary text,intent text,core_value text,why_niwangu text,photo_url text,alignment_reasons text[],photos text[])
language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id(); premium boolean;
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 if p_section not in ('discover','likes','saved') then raise exception 'Invalid section'; end if;
 premium:=public.has_active_premium(actor);
 if p_section='likes' and not premium then raise exception 'premium_required'; end if;
 if p_section='discover' and public.is_profile_view_locked(actor) then return; end if;
 return query
 select p.id,p.full_name,p.age,p.gender,p.location,p.boundary,p.intent,p.core_value,p.why_niwangu,
 (select ph.public_url from public.profile_photos ph where ph.profile_id=p.id order by ph.sort_order limit 1),
 public.compatibility_reasons(actor,p.id),
 array(select ph.public_url from public.profile_photos ph where ph.profile_id=p.id order by ph.sort_order)
 from public.profiles p
 left join public.member_preferences prefs on prefs.profile_id=actor
 left join public.member_preferences other on other.profile_id=p.id
 where p.id<>actor and p.profile_ready and not p.discovery_paused
 and public.is_mutually_eligible(actor,p.id) and not public.members_blocked(actor,p.id)
 and (not coalesce(other.incognito,false) or not public.has_active_premium(p.id) or exists(
 select 1 from public.swipes s where s.actor_profile_id=p.id and s.target_profile_id=actor and s.direction='like'))
 and p.age between coalesce(prefs.min_age,18) and coalesce(prefs.max_age,100)
 and (coalesce(prefs.town,'')='' or lower(p.location)=lower(prefs.town))
 and (not premium or coalesce(prefs.intent,'')='' or p.intent=prefs.intent)
 and (not premium or coalesce(prefs.core_value,'')='' or p.core_value=prefs.core_value)
 and not exists(select 1 from public.matches m where actor in(m.profile_low_id,m.profile_high_id) and p.id in(m.profile_low_id,m.profile_high_id))
 and not exists(select 1 from public.swipes s where s.actor_profile_id=actor and s.target_profile_id=p.id)
 and (p_section<>'likes' or exists(select 1 from public.swipes s where s.actor_profile_id=p.id and s.target_profile_id=actor and s.direction='like'))
 and (p_section<>'saved' or exists(select 1 from public.saved_profiles sp where sp.profile_id=actor and sp.target_profile_id=p.id))
 order by exists(select 1 from public.swipes s where s.actor_profile_id=p.id and s.target_profile_id=actor and s.direction='like') desc,
 public.compatibility_score(actor,p.id) * case when p.boost_active_until>now() then 3 else 1 end desc,
 p.created_at desc,p.id
 offset greatest(0,coalesce(p_offset,0)) limit least(50,greatest(1,coalesce(p_limit,20)));
end; $$;
-- Compatibility wrapper: older clients must no longer meter reads.
drop function public.get_gallery_profiles(integer);
create function public.get_gallery_profiles(limit_count integer default 20)
returns table(id uuid,name text,age integer,gender public.gender_type,location text,boundary text,intent text,core_value text,why_niwangu text,photo_url text,alignment_reasons text[])
language sql stable security definer set search_path=public as $$
 select d.id,d.name,d.age,d.gender,d.location,d.boundary,d.intent,d.core_value,d.why_niwangu,d.photo_url,d.alignment_reasons
 from public.get_discovery_profiles('discover',0,limit_count) d;
$$;
create or replace function public.handle_swipe(p_target_profile_id uuid,p_direction public.swipe_direction)
returns table(matched boolean,match_id uuid,remaining_swipes integer)
language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id(); mid uuid; used integer;
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 -- Global short transaction lock serializes reciprocal likes and quota checks, preventing missed matches.
 perform pg_advisory_xact_lock(741028);
 if p_direction is null or p_target_profile_id is null or p_target_profile_id=actor then raise exception 'Invalid swipe'; end if;
 if exists(select 1 from public.matches m where actor in(m.profile_low_id,m.profile_high_id) and p_target_profile_id in(m.profile_low_id,m.profile_high_id)) then raise exception 'Already matched'; end if;
 if exists(select 1 from public.swipes s where s.actor_profile_id=actor and s.target_profile_id=p_target_profile_id) then
  return query select false,null::uuid,(select remaining_views from public.get_profile_view_status()); return;
 end if;
 if public.is_profile_view_locked(actor) then raise exception 'daily_limit_reached'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_target_profile_id and p.profile_ready and not p.discovery_paused)
 or not public.is_mutually_eligible(actor,p_target_profile_id) or public.members_blocked(actor,p_target_profile_id) then raise exception 'Profile unavailable'; end if;
 if not exists(select 1 from public.profiles where id=actor and profile_ready and not discovery_paused) then raise exception 'Complete or resume your profile first'; end if;
 if exists(select 1 from public.member_preferences prefs where prefs.profile_id=p_target_profile_id and prefs.incognito)
 and public.has_active_premium(p_target_profile_id)
 and not exists(select 1 from public.swipes where actor_profile_id=p_target_profile_id and target_profile_id=actor and direction='like') then raise exception 'Profile unavailable'; end if;
 insert into public.swipes(actor_profile_id,target_profile_id,direction) values(actor,p_target_profile_id,p_direction);
 insert into public.member_decisions(profile_id,target_profile_id,direction) values(actor,p_target_profile_id,p_direction);
 delete from public.saved_profiles where profile_id=actor and target_profile_id=p_target_profile_id;
 if p_direction='like' and exists(select 1 from public.swipes where actor_profile_id=p_target_profile_id and target_profile_id=actor and direction='like') then
  insert into public.matches(profile_low_id,profile_high_id) values(least(actor,p_target_profile_id),greatest(actor,p_target_profile_id))
  on conflict(profile_low_id,profile_high_id) do nothing;
  select m.id into mid from public.matches m where m.profile_low_id=least(actor,p_target_profile_id) and m.profile_high_id=greatest(actor,p_target_profile_id);
 end if;
 return query select mid is not null,mid,(select remaining_views from public.get_profile_view_status());
end; $$;
create function public.undo_last_pass() returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id(); target uuid;
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 if not public.has_active_premium(actor) then raise exception 'premium_required'; end if;
 perform pg_advisory_xact_lock(741028);
 select target_profile_id into target from public.member_decisions where profile_id=actor order by created_at desc,id desc limit 1;
 delete from public.swipes where actor_profile_id=actor and target_profile_id=target and direction='pass';
 if not found then raise exception 'Your last decision was not a pass'; end if;
 return target;
end; $$;
create function public.block_member(p_target uuid) returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id();
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 if p_target=actor or not exists(select 1 from public.profiles where id=p_target) then raise exception 'Invalid member'; end if;
 perform pg_advisory_xact_lock(741028);
 insert into public.member_blocks(profile_id,target_profile_id) values(actor,p_target) on conflict do nothing;
 update public.matches set status='closed',closed_at=now(),closed_by_profile_id=actor,close_reason='Connection ended'
 where actor in(profile_low_id,profile_high_id) and p_target in(profile_low_id,profile_high_id);
 delete from public.saved_profiles where (profile_id=actor and target_profile_id=p_target) or (profile_id=p_target and target_profile_id=actor);
end; $$;
create function public.unblock_member(p_target uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if public.current_profile_id() is null then raise exception 'Not authenticated'; end if;
 delete from public.member_blocks where profile_id=public.current_profile_id() and target_profile_id=p_target;
end; $$;
create function public.report_member(p_target uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
begin
 if public.current_profile_id() is null then raise exception 'Not authenticated'; end if;
 if p_target=public.current_profile_id() or not exists(select 1 from public.profiles where id=p_target) then raise exception 'Invalid member'; end if;
 if (select count(*) from public.member_reports where profile_id=public.current_profile_id() and created_at>now()-interval '1 hour')>=10 then raise exception 'Please wait before submitting another report'; end if;
 insert into public.member_reports(profile_id,target_profile_id,reason) values(public.current_profile_id(),p_target,trim(p_reason));
end; $$;
-- Auth profile creation is trigger-owned; clients cannot INSERT elevated plan fields.
drop policy if exists profiles_insert_self on public.profiles;

create or replace function public.get_match_messages(
  p_match_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null,
  p_after timestamptz default null
)
returns table (
  id uuid,
  sender_profile_id uuid,
  body text,
  is_system boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;


  if exists(select 1 from public.matches m where m.id=p_match_id and public.members_blocked(m.profile_low_id,m.profile_high_id)) then
    raise exception 'Connection unavailable';
  end if;
  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and v_profile_id in (m.profile_low_id, m.profile_high_id)
  ) then
    raise exception 'Match not found';
  end if;

  -- p_after streams forward from a cursor (catching up after a reconnect) and
  -- is returned oldest-first. Everything else pages backwards through history.
  if p_after is not null then
    return query
    select msg.id, msg.sender_profile_id, msg.body, msg.is_system, msg.created_at
    from public.messages msg
    where msg.match_id = p_match_id
      and msg.created_at > p_after
    order by msg.created_at asc
    limit v_limit;

    return;
  end if;

  return query
  select ordered.id, ordered.sender_profile_id, ordered.body, ordered.is_system, ordered.created_at
  from (
    select msg.id, msg.sender_profile_id, msg.body, msg.is_system, msg.created_at
    from public.messages msg
    where msg.match_id = p_match_id
      and (p_before is null or msg.created_at < p_before)
    order by msg.created_at desc
    limit v_limit
  ) ordered
  order by ordered.created_at asc;
end;
$$;

create or replace function public.send_match_message(
  p_match_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_profile_id uuid := public.current_profile_id();
  v_status public.match_status;
  v_partner_boundary text;
begin
  if v_sender_profile_id is null then
    raise exception 'Not authenticated';
  end if;


  if exists(select 1 from public.matches m where m.id=p_match_id and public.members_blocked(m.profile_low_id,m.profile_high_id)) then
    raise exception 'Connection unavailable';
  end if;
  if not public.is_match_participant(p_match_id) then
    raise exception 'Forbidden';
  end if;

  select status into v_status
  from public.matches m
  where m.id = p_match_id;

  if v_status <> 'open' then
    raise exception 'This conversation is closed';
  end if;

  select nullif(trim(partner.boundary), '')
  into v_partner_boundary
  from public.matches m
  join public.profiles partner
    on partner.id = case
         when m.profile_low_id = v_sender_profile_id then m.profile_high_id
         else m.profile_low_id
       end
  where m.id = p_match_id;

  -- Only gates people who actually stated a boundary, and only until it has
  -- been acknowledged once.
  if v_partner_boundary is not null and not exists (
    select 1
    from public.match_boundary_acks a
    where a.match_id = p_match_id
      and a.profile_id = v_sender_profile_id
  ) then
    raise exception 'boundary_not_acknowledged';
  end if;

  if p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Message must contain 1 to 2000 characters'; end if;

  insert into public.messages (match_id, sender_profile_id, body)
  values (p_match_id, v_sender_profile_id, trim(p_body));
end;
$$;

create or replace function public.get_matches()
returns table (
  id uuid,
  partner_id uuid,
  partner_name text,
  partner_photo text,
  garden_level numeric,
  values_overlap text[],
  is_closed boolean,
  last_message text,
  last_message_at timestamptz,
  unread_count integer,
  partner_boundary text,
  boundary_acknowledged boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;


  return query
  with my_profile as (
    select p.id, p.intent, p.core_value, p.why_niwangu
    from public.profiles p
    where p.id = v_profile_id
  ),
  first_photos as (
    select distinct on (profile_id)
      profile_id,
      public_url
    from public.profile_photos
    order by profile_id, sort_order asc
  ),
  message_counts as (
    select match_id, count(*)::numeric as total_messages
    from public.messages
    group by match_id
  )
  select
    m.id,
    partner.id as partner_id,
    partner.full_name as partner_name,
    fp.public_url as partner_photo,
    least(5, greatest(1, coalesce(mc.total_messages, 0) / 2 + 1)) as garden_level,
    -- Now derived from the Ritual codes rather than free-text equality.
    public.compatibility_reasons(me.id, partner.id) as values_overlap,
    m.status = 'closed' as is_closed,
    last_message.body as last_message,
    last_message.created_at as last_message_at,
    coalesce(unread.total, 0)::integer as unread_count,
    nullif(trim(partner.boundary), '') as partner_boundary,
    (
      nullif(trim(partner.boundary), '') is null
      or exists (
        select 1
        from public.match_boundary_acks a
        where a.match_id = m.id
          and a.profile_id = me.id
      )
    ) as boundary_acknowledged
  from public.matches m
  join my_profile me on me.id in (m.profile_low_id, m.profile_high_id)
  join public.profiles partner on partner.id = case
    when m.profile_low_id = me.id then m.profile_high_id
    else m.profile_low_id
  end
  left join first_photos fp on fp.profile_id = partner.id
  left join message_counts mc on mc.match_id = m.id
  left join lateral (
    select body, created_at
    from public.messages
    where match_id = m.id
    order by created_at desc
    limit 1
  ) last_message on true
  left join public.match_reads mr on mr.match_id = m.id and mr.profile_id = me.id
  -- Only the partner's messages count as unread; your own never do.
  left join lateral (
    select count(*) as total
    from public.messages unread_msg
    where unread_msg.match_id = m.id
      and unread_msg.sender_profile_id <> me.id
      and not unread_msg.is_system
      and (mr.last_read_at is null or unread_msg.created_at > mr.last_read_at)
  ) unread on true
  where not public.members_blocked(me.id, partner.id)
  order by coalesce(last_message.created_at, m.created_at) desc;
end;
$$;

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants on public.messages for select to authenticated using(
 public.is_match_participant(match_id) and not exists(select 1 from public.matches m where m.id=match_id and public.members_blocked(m.profile_low_id,m.profile_high_id))
);
revoke all on function public.members_blocked(uuid,uuid) from public,anon;
grant execute on function public.members_blocked(uuid,uuid) to authenticated,service_role;
revoke all on function public.get_profile_view_status() from public,anon;
grant execute on function public.get_profile_view_status() to authenticated,service_role;
revoke all on function public.is_profile_view_locked(uuid) from public,anon;
grant execute on function public.is_profile_view_locked(uuid) to authenticated,service_role;
revoke all on function public.get_discovery_profiles(text,integer,integer) from public,anon;
grant execute on function public.get_discovery_profiles(text,integer,integer) to authenticated,service_role;
revoke all on function public.get_gallery_profiles(integer) from public,anon;
grant execute on function public.get_gallery_profiles(integer) to authenticated,service_role;
revoke all on function public.handle_swipe(uuid,public.swipe_direction) from public,anon;
grant execute on function public.handle_swipe(uuid,public.swipe_direction) to authenticated,service_role;
revoke all on function public.undo_last_pass() from public,anon;
grant execute on function public.undo_last_pass() to authenticated,service_role;
revoke all on function public.block_member(uuid) from public,anon;
grant execute on function public.block_member(uuid) to authenticated,service_role;
revoke all on function public.unblock_member(uuid) from public,anon;
grant execute on function public.unblock_member(uuid) to authenticated,service_role;
revoke all on function public.report_member(uuid,text) from public,anon;
grant execute on function public.report_member(uuid,text) to authenticated,service_role;

-- Premium includes 2 boosts per 30 purchased days, minimum 1 per pass.
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
  v_now timestamptz := now();
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
  if p_paid_amount is null or p_paid_amount < v_payment.amount then
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
    where p.id = v_payment.profile_id
    for update;

    update public.profiles
    set is_premium = true,
        subscription_plan = v_plan.plan_id,
        premium_expires_at = v_base + make_interval(days => v_plan.duration_days),
        boost_credits = boost_credits + greatest(1, (v_plan.duration_days / 30) * 2),
        payment_reference = coalesce(p_provider_receipt, p_reference)
    where id = v_payment.profile_id;
  end if;

  return 'activated';
end;
$$;
