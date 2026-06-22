create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default timezone('utc', now()),
  unique (viewer_profile_id, target_profile_id),
  check (viewer_profile_id <> target_profile_id)
);

create index if not exists profile_views_viewer_viewed_at_idx
on public.profile_views (viewer_profile_id, viewed_at desc);

alter table public.profile_views enable row level security;

drop policy if exists "profile_views_select_own" on public.profile_views;
create policy "profile_views_select_own"
on public.profile_views
for select
to authenticated
using (viewer_profile_id = public.current_profile_id());

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

create or replace function public.is_profile_view_locked(p_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(not p.is_premium, true)
    and (
      select count(*) >= coalesce(p.daily_swipe_limit, 5)
      from public.profile_views pv
      where pv.viewer_profile_id = p.id
        and pv.viewed_at >= now() - interval '24 hours'
    )
  from public.profiles p
  where p.id = p_profile_id;
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
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_premium, daily_swipe_limit
  into v_is_premium, v_limit
  from public.profiles p
  where p.id = v_profile_id;

  select count(*), min(viewed_at) + interval '24 hours'
  into v_used, v_locked_until
  from public.profile_views
  where viewer_profile_id = v_profile_id
    and viewed_at >= now() - interval '24 hours';

  return query
  select
    coalesce(v_used, 0),
    case
      when coalesce(v_is_premium, false) then coalesce(v_limit, 5)
      else greatest(0, coalesce(v_limit, 5) - coalesce(v_used, 0))
    end,
    not coalesce(v_is_premium, false) and coalesce(v_used, 0) >= coalesce(v_limit, 5),
    case
      when not coalesce(v_is_premium, false) and coalesce(v_used, 0) >= coalesce(v_limit, 5) then v_locked_until
      else null
    end,
    2000;
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
  v_take integer;
  v_returned integer;
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_profile_id::text, 0));

  select is_premium, daily_swipe_limit
  into v_is_premium, v_limit
  from public.profiles p
  where p.id = v_profile_id;

  v_limit := coalesce(v_limit, 5);
  v_take := 1;

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

  if not coalesce(v_is_premium, false) and v_remaining <= 0 then
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

  select is_premium, daily_swipe_limit
  into v_is_premium, v_daily_limit
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

  if not coalesce(v_is_premium, false) and not v_target_was_viewed then
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
      when coalesce(v_is_premium, false) then v_daily_limit
      else greatest(0, v_daily_limit - coalesce(v_view_count, 0))
    end;
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
  last_message_at timestamptz
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

  if public.is_profile_view_locked(v_profile_id) then
    raise exception 'profile_view_limit_reached';
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
    array_remove(array[
      case when partner.intent = me.intent and partner.intent <> '' then partner.intent end,
      case when partner.core_value = me.core_value and partner.core_value <> '' then partner.core_value end,
      case when partner.why_niwangu = me.why_niwangu and partner.why_niwangu <> '' then partner.why_niwangu end
    ], null) as values_overlap,
    m.status = 'closed' as is_closed,
    last_message.body as last_message,
    last_message.created_at as last_message_at
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
  order by coalesce(last_message.created_at, m.created_at) desc;
end;
$$;

create or replace function public.get_match_messages(p_match_id uuid)
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
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_profile_view_locked(v_profile_id) then
    raise exception 'profile_view_limit_reached';
  end if;

  return query
  select
    msg.id,
    msg.sender_profile_id,
    msg.body,
    msg.is_system,
    msg.created_at
  from public.messages msg
  where msg.match_id = p_match_id
    and public.is_match_participant(p_match_id)
  order by msg.created_at asc;
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
begin
  if v_sender_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_profile_view_locked(v_sender_profile_id) then
    raise exception 'profile_view_limit_reached';
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

  insert into public.messages (match_id, sender_profile_id, body)
  values (p_match_id, v_sender_profile_id, trim(p_body));
end;
$$;

create or replace function public.unlock_premium_after_payment()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set is_premium = true,
      daily_swipe_limit = 5
  where profiles.id = v_profile_id;
end;
$$;

revoke execute on function public.get_profile_view_status() from public;
revoke execute on function public.get_gallery_profiles(integer) from public;
revoke execute on function public.handle_swipe(uuid, public.swipe_direction) from public;
revoke execute on function public.get_matches() from public;
revoke execute on function public.get_match_messages(uuid) from public;
revoke execute on function public.send_match_message(uuid, text) from public;
revoke execute on function public.unlock_premium_after_payment() from public;

grant execute on function public.get_profile_view_status() to authenticated;
grant execute on function public.get_gallery_profiles(integer) to authenticated;
grant execute on function public.handle_swipe(uuid, public.swipe_direction) to authenticated;
grant execute on function public.get_matches() to authenticated;
grant execute on function public.get_match_messages(uuid) to authenticated;
grant execute on function public.send_match_message(uuid, text) to authenticated;
grant execute on function public.unlock_premium_after_payment() to authenticated;
