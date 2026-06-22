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

  select is_premium, daily_swipe_limit
  into v_is_premium, v_limit
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

revoke execute on function public.get_gallery_profiles(integer) from public;
grant execute on function public.get_gallery_profiles(integer) to authenticated;
