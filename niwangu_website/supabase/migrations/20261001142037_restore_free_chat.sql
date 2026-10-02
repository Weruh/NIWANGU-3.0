-- Matched chat is independent of discovery limits. Participant and boundary checks remain.

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
  order by coalesce(last_message.created_at, m.created_at) desc;
end;
$$;