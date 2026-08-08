-- Chat scalability and read tracking.
--
-- get_match_messages() returned every message in a thread and the client
-- refetched all of them on each new message, so a long conversation got
-- quadratically slower. It now takes a page size and cursors.
--
-- Unread counts previously did not exist, so the chat list could not show which
-- conversations were waiting on a reply.

-- 1. Paged message reads ------------------------------------------------------

-- The signature changes, so the single-argument version has to go first;
-- leaving both would make the PostgREST overload ambiguous.
drop function if exists public.get_match_messages(uuid);

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

  if public.is_profile_view_locked(v_profile_id) then
    raise exception 'profile_view_limit_reached';
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

create index if not exists messages_match_created_at_idx
on public.messages (match_id, created_at desc);

-- 2. Read tracking ------------------------------------------------------------

create table if not exists public.match_reads (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, profile_id)
);

alter table public.match_reads enable row level security;

drop policy if exists "match_reads_select_own" on public.match_reads;
create policy "match_reads_select_own"
on public.match_reads
for select
to authenticated
using (profile_id = public.current_profile_id());

create or replace function public.mark_match_read(p_match_id uuid)
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

  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and v_profile_id in (m.profile_low_id, m.profile_high_id)
  ) then
    raise exception 'Match not found';
  end if;

  insert into public.match_reads (match_id, profile_id, last_read_at)
  values (p_match_id, v_profile_id, timezone('utc', now()))
  on conflict (match_id, profile_id) do update
    set last_read_at = excluded.last_read_at;
end;
$$;

-- 3. get_matches now carries the unread count --------------------------------

drop function if exists public.get_matches();

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
  unread_count integer
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
    last_message.created_at as last_message_at,
    coalesce(unread.total, 0)::integer as unread_count
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
  order by coalesce(last_message.created_at, m.created_at) desc;
end;
$$;

revoke execute on function public.get_match_messages(uuid, integer, timestamptz, timestamptz) from public;
revoke execute on function public.get_matches() from public;
revoke execute on function public.mark_match_read(uuid) from public;

grant execute on function public.get_match_messages(uuid, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_matches() to authenticated;
grant execute on function public.mark_match_read(uuid) to authenticated;
