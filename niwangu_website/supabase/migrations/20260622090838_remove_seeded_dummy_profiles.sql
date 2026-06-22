with seeded_profiles(id) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid),
    ('22222222-2222-2222-2222-222222222222'::uuid),
    ('33333333-3333-3333-3333-333333333333'::uuid),
    ('44444444-4444-4444-4444-444444444444'::uuid),
    ('55555555-5555-5555-5555-555555555555'::uuid),
    ('66666666-6666-6666-6666-666666666666'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000003'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000004'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000005'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000006'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000007'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000008'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000009'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000010'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000011'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000012'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000013'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000014'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000015'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000016'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000017'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000018'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000019'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000020'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000021'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000022'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000023'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000024'::uuid),
    ('aaaaaaaa-0000-0000-0000-000000000025'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000001'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000002'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000003'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000004'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000005'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000006'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000007'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000008'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000009'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000010'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000011'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000012'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000013'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000014'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000015'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000016'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000017'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000018'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000019'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000020'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000021'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000022'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000023'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000024'::uuid),
    ('bbbbbbbb-0000-0000-0000-000000000025'::uuid)
)
delete from public.profiles p
using seeded_profiles s
where p.id = s.id
  and p.auth_user_id is null;

drop trigger if exists on_message_seeded_auto_reply on public.messages;
drop function if exists public.handle_seeded_auto_reply();

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
