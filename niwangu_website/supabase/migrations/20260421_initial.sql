create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'gender_type'
  ) then
    create type public.gender_type as enum ('female', 'male');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'swipe_direction'
  ) then
    create type public.swipe_direction as enum ('like', 'pass');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'match_status'
  ) then
    create type public.match_status as enum ('open', 'closed');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  full_name text,
  age integer check (age is null or age >= 18),
  gender public.gender_type,
  seeking_gender public.gender_type,
  location text,
  intent text default '',
  core_value text default '',
  why_niwangu text default '',
  boundary text default '',
  onboarding_completed boolean not null default false,
  profile_ready boolean not null default false,
  is_premium boolean not null default false,
  daily_swipe_limit integer not null default 5,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ritual_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  question_id integer not null,
  answer_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, question_id)
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sort_order integer not null check (sort_order between 0 and 2),
  public_url text not null,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, sort_order)
);

create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (actor_profile_id, target_profile_id),
  check (actor_profile_id <> target_profile_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_low_id uuid not null references public.profiles (id) on delete cascade,
  profile_high_id uuid not null references public.profiles (id) on delete cascade,
  status public.match_status not null default 'open',
  close_reason text,
  closed_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  unique (profile_low_id, profile_high_id),
  check (profile_low_id <> profile_high_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists ritual_answers_touch_updated_at on public.ritual_answers;
create trigger ritual_answers_touch_updated_at
before update on public.ritual_answers
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gender_text text := nullif(new.raw_user_meta_data ->> 'gender', '');
  seeking_gender_text text := nullif(new.raw_user_meta_data ->> 'seeking_gender', '');
  age_text text := nullif(new.raw_user_meta_data ->> 'age', '');
begin
  insert into public.profiles (
    auth_user_id,
    full_name,
    age,
    gender,
    seeking_gender,
    location
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when age_text ~ '^\d+$' then age_text::integer else null end,
    case when gender_text in ('female', 'male') then gender_text::public.gender_type else null end,
    case when seeking_gender_text in ('female', 'male') then seeking_gender_text::public.gender_type else null end,
    coalesce(new.raw_user_meta_data ->> 'location', '')
  )
  on conflict (auth_user_id) do update
    set full_name = excluded.full_name,
        age = excluded.age,
        gender = excluded.gender,
        seeking_gender = excluded.seeking_gender,
        location = excluded.location;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and public.current_profile_id() in (m.profile_low_id, m.profile_high_id)
  );
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
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select *
    from public.profiles
    where id = public.current_profile_id()
  ),
  first_photos as (
    select distinct on (profile_id)
      profile_id,
      public_url
    from public.profile_photos
    order by profile_id, sort_order asc
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
  order by random()
  limit greatest(limit_count, 1);
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
language sql
stable
security definer
set search_path = public
as $$
  with my_profile as (
    select id, intent, core_value, why_niwangu
    from public.profiles
    where id = public.current_profile_id()
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
$$;

create or replace function public.get_match_messages(p_match_id uuid)
returns table (
  id uuid,
  sender_profile_id uuid,
  body text,
  is_system boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
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

  if not public.is_match_participant(p_match_id) then
    raise exception 'Forbidden';
  end if;

  select status into v_status
  from public.matches
  where id = p_match_id;

  if v_status <> 'open' then
    raise exception 'This conversation is closed';
  end if;

  insert into public.messages (match_id, sender_profile_id, body)
  values (p_match_id, v_sender_profile_id, trim(p_body));
end;
$$;

create or replace function public.close_match(
  p_match_id uuid,
  p_reason text
)
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

  if not public.is_match_participant(p_match_id) then
    raise exception 'Forbidden';
  end if;

  update public.matches
  set
    status = 'closed',
    close_reason = trim(p_reason),
    closed_by_profile_id = v_profile_id,
    closed_at = timezone('utc', now())
  where id = p_match_id
    and status <> 'closed';

  insert into public.messages (match_id, sender_profile_id, body, is_system)
  values (
    p_match_id,
    v_profile_id,
    '[Connection Closed]: ' || trim(p_reason),
    true
  );
end;
$$;

create or replace function public.handle_seeded_auto_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_profile_id uuid;
  v_sender_auth_user_id uuid;
  v_partner_auth_user_id uuid;
  v_reply text;
  v_replies text[] := array[
    'I appreciate that clarity. What kind of relationship rhythm feels healthiest to you?',
    'That resonates with me. What does emotional safety look like for you in practice?',
    'Intentionality matters to me too. What are you protecting in this season of life?',
    'I value that answer. What would help a connection feel grounded instead of rushed?'
  ];
begin
  if new.is_system then
    return new;
  end if;

  select auth_user_id
  into v_sender_auth_user_id
  from public.profiles
  where id = new.sender_profile_id;

  select case
    when m.profile_low_id = new.sender_profile_id then m.profile_high_id
    else m.profile_low_id
  end
  into v_partner_profile_id
  from public.matches m
  where m.id = new.match_id;

  select auth_user_id
  into v_partner_auth_user_id
  from public.profiles
  where id = v_partner_profile_id;

  if v_sender_auth_user_id is null or v_partner_auth_user_id is not null then
    return new;
  end if;

  v_reply := v_replies[1 + floor(random() * array_length(v_replies, 1))::integer];

  insert into public.messages (match_id, sender_profile_id, body)
  values (new.match_id, v_partner_profile_id, v_reply);

  return new;
end;
$$;

drop trigger if exists on_message_seeded_auto_reply on public.messages;
create trigger on_message_seeded_auto_reply
after insert on public.messages
for each row
execute function public.handle_seeded_auto_reply();

alter table public.profiles enable row level security;
alter table public.ritual_answers enable row level security;
alter table public.profile_photos enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
on public.profiles
for select
to authenticated
using (profile_ready = true or auth_user_id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "ritual_answers_manage_own" on public.ritual_answers;
create policy "ritual_answers_manage_own"
on public.ritual_answers
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = ritual_answers.profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = ritual_answers.profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "profile_photos_select_visible" on public.profile_photos;
create policy "profile_photos_select_visible"
on public.profile_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_photos.profile_id
      and (p.profile_ready = true or p.auth_user_id = auth.uid())
  )
);

drop policy if exists "profile_photos_manage_own" on public.profile_photos;
create policy "profile_photos_manage_own"
on public.profile_photos
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_photos.profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_photos.profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "swipes_select_own" on public.swipes;
create policy "swipes_select_own"
on public.swipes
for select
to authenticated
using (actor_profile_id = public.current_profile_id());

drop policy if exists "matches_select_participants" on public.matches;
create policy "matches_select_participants"
on public.matches
for select
to authenticated
using (public.is_match_participant(id));

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (public.is_match_participant(match_id));

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own_folder" on storage.objects;
create policy "profile_photos_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_update_own_folder" on storage.objects;
create policy "profile_photos_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_delete_own_folder" on storage.objects;
create policy "profile_photos_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
