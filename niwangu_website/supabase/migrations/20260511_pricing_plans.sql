alter table public.profiles
  alter column daily_swipe_limit set default 5;

update public.profiles
set daily_swipe_limit = 5
where coalesce(daily_swipe_limit, 10) = 10;

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
  v_target_auth_user_id uuid;
  v_is_premium boolean;
  v_daily_limit integer;
  v_swipe_count integer;
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
  from public.profiles
  where id = v_actor_profile_id;

  select count(*)
  into v_swipe_count
  from public.swipes
  where actor_profile_id = v_actor_profile_id
    and created_at::date = timezone('utc', now())::date;

  if not coalesce(v_is_premium, false) and v_swipe_count >= coalesce(v_daily_limit, 5) then
    raise exception 'daily_limit_reached';
  end if;

  insert into public.swipes (actor_profile_id, target_profile_id, direction)
  values (v_actor_profile_id, p_target_profile_id, p_direction)
  on conflict (actor_profile_id, target_profile_id) do update
    set direction = excluded.direction,
        created_at = timezone('utc', now());

  select auth_user_id
  into v_target_auth_user_id
  from public.profiles
  where id = p_target_profile_id;

  if p_direction = 'like' and (
    v_target_auth_user_id is null or exists (
      select 1
      from public.swipes reverse_swipe
      where reverse_swipe.actor_profile_id = p_target_profile_id
        and reverse_swipe.target_profile_id = v_actor_profile_id
        and reverse_swipe.direction = 'like'
    )
  ) then
    insert into public.matches (profile_low_id, profile_high_id)
    values (least(v_actor_profile_id, p_target_profile_id), greatest(v_actor_profile_id, p_target_profile_id))
    on conflict (profile_low_id, profile_high_id) do nothing
    returning id into v_new_match_id;

    if v_new_match_id is not null and v_target_auth_user_id is null then
      insert into public.messages (match_id, sender_profile_id, body)
      values (
        v_new_match_id,
        p_target_profile_id,
        'I appreciate intentional energy. What stood out to you in my profile?'
      );
    end if;
  end if;

  select count(*)
  into v_swipe_count
  from public.swipes
  where actor_profile_id = v_actor_profile_id
    and created_at::date = timezone('utc', now())::date;

  return query
  select
    v_new_match_id is not null,
    v_new_match_id,
    greatest(0, coalesce(v_daily_limit, 5) - v_swipe_count);
end;
$$;
