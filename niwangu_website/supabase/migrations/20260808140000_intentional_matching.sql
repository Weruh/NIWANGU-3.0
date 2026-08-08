-- Intentional matching.
--
-- Until now discovery was `order by random()` over a one-directional gender
-- filter, and the twelve Ritual answers were stored but never read. This
-- migration turns those answers into the matching signal:
--
--   1. profile_traits      — the answers as stable codes, not display strings
--   2. compatibility_*     — a tunable, explainable score plus its reasons
--   3. get_gallery_profiles— reciprocal gates, reciprocity-first, weighted sampling
--   4. match_boundary_acks — you must read someone's boundary before messaging
--
-- Nothing here relaxes the paywall: view metering and the premium checks are
-- carried over unchanged.

-- =============================================================================
-- 1. Ritual answers as stable codes
-- =============================================================================

-- Matching must never depend on display copy. Rewording an option becomes an
-- insert here rather than a silent scoring regression.
create table if not exists public.ritual_answer_codes (
  question_id integer not null,
  answer_text text not null,
  code text not null,
  is_canonical boolean not null default true,
  primary key (question_id, answer_text)
);

insert into public.ritual_answer_codes (question_id, answer_text, code) values
  -- Q1 Intent
  (1, 'A Life Partnership',            'partnership'),
  (1, 'A Deep Friendship',             'friendship'),
  (1, 'A Family Foundation',           'family'),
  (1, 'Self-Discovery',                'self'),
  -- Q2 Timeline
  (2, 'Immediate',                     'immediate'),
  (2, 'Within a year',                 'within_year'),
  (2, 'Open-ended',                    'open'),
  (2, 'Taking it slow',                'slow'),
  -- Q3 Career stage
  (3, 'Building',                      'building'),
  (3, 'Established',                   'established'),
  (3, 'Transitioning',                 'transitioning'),
  (3, 'Searching',                     'searching'),
  -- Q4 Has children
  (4, 'Yes, and they are my world',    'yes_dependent'),
  (4, 'Yes, they are independent',     'yes_independent'),
  (4, 'No',                            'none'),
  -- Q5 Wants children
  (5, 'Yes, absolutely',               'yes'),
  (5, 'Maybe, with the right person',  'maybe'),
  (5, 'No, my family is complete',     'no'),
  -- Q6 Core value
  (6, 'Integrity',                     'integrity'),
  (6, 'Creativity',                    'creativity'),
  (6, 'Security',                      'security'),
  (6, 'Freedom',                       'freedom'),
  (6, 'Community',                     'community'),
  -- Q7 Non-negotiable (kept for display; unscoreable without self-disclosure)
  (7, 'Smoking',                       'smoking'),
  (7, 'Dishonesty',                    'dishonesty'),
  (7, 'Lack of Ambition',              'ambition'),
  (7, 'Emotional Unavailability',      'unavailability'),
  -- Q8 Conflict style
  (8, 'Space then Talk',               'space_then_talk'),
  (8, 'Talk immediately',              'talk_now'),
  (8, 'Process internally',            'internal'),
  (8, 'Seek mediation',                'mediation'),
  -- Q9 Social energy
  (9, 'Introverted Homebody',          'introvert'),
  (9, 'Extroverted Explorer',          'extrovert'),
  (9, 'Ambivert',                      'ambivert'),
  (9, 'Socially Selective',            'selective'),
  -- Q10 Why Niwangu (acquisition metadata; not scored)
  (10, 'Tired of swiping',             'tired_swiping'),
  (10, 'Seeking depth',                'depth'),
  (10, 'Recommended by friend',        'referral'),
  (10, 'Curiosity',                    'curiosity'),
  -- Q11 Introspection
  (11, 'Vital',                        'vital'),
  (11, 'Important',                    'important'),
  (11, 'Occasional',                   'occasional'),
  (11, 'Not a priority',               'not_priority')
on conflict (question_id, answer_text) do update
  set code = excluded.code;

create table if not exists public.profile_traits (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  intent_code text,
  timeline_code text,
  career_code text,
  has_children_code text,
  wants_children_code text,
  core_value_code text,
  non_negotiable_code text,
  conflict_code text,
  social_code text,
  why_code text,
  introspection_code text,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexed because the children gate and the score both read them on every
-- gallery request.
create index if not exists profile_traits_children_idx
on public.profile_traits (wants_children_code);

alter table public.profile_traits enable row level security;

drop policy if exists "profile_traits_select_own" on public.profile_traits;
create policy "profile_traits_select_own"
on public.profile_traits
for select
to authenticated
using (profile_id = public.current_profile_id());

-- Recomputes one member's traits from their ritual answers. Called by trigger,
-- so the table can never drift from the answers it is derived from.
create or replace function public.sync_profile_traits(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codes jsonb;
begin
  if p_profile_id is null then
    return;
  end if;

  select coalesce(jsonb_object_agg(ra.question_id::text, rac.code), '{}'::jsonb)
  into v_codes
  from public.ritual_answers ra
  join public.ritual_answer_codes rac
    on rac.question_id = ra.question_id
   and rac.answer_text = ra.answer_text
  where ra.profile_id = p_profile_id;

  insert into public.profile_traits as pt (
    profile_id,
    intent_code, timeline_code, career_code, has_children_code,
    wants_children_code, core_value_code, non_negotiable_code,
    conflict_code, social_code, why_code, introspection_code,
    updated_at
  )
  values (
    p_profile_id,
    v_codes ->> '1',  v_codes ->> '2',  v_codes ->> '3',  v_codes ->> '4',
    v_codes ->> '5',  v_codes ->> '6',  v_codes ->> '7',
    v_codes ->> '8',  v_codes ->> '9',  v_codes ->> '10', v_codes ->> '11',
    timezone('utc', now())
  )
  on conflict (profile_id) do update set
    intent_code          = excluded.intent_code,
    timeline_code        = excluded.timeline_code,
    career_code          = excluded.career_code,
    has_children_code    = excluded.has_children_code,
    wants_children_code  = excluded.wants_children_code,
    core_value_code      = excluded.core_value_code,
    non_negotiable_code  = excluded.non_negotiable_code,
    conflict_code        = excluded.conflict_code,
    social_code          = excluded.social_code,
    why_code             = excluded.why_code,
    introspection_code   = excluded.introspection_code,
    updated_at           = timezone('utc', now());
end;
$$;

create or replace function public.ritual_answers_sync_traits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_traits(
    case when tg_op = 'DELETE' then old.profile_id else new.profile_id end
  );
  return null;
end;
$$;

drop trigger if exists ritual_answers_sync_traits on public.ritual_answers;
create trigger ritual_answers_sync_traits
after insert or update or delete on public.ritual_answers
for each row
execute function public.ritual_answers_sync_traits();

-- Backfill everyone who already completed the Ritual.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.profiles loop
    perform public.sync_profile_traits(v_id);
  end loop;
end;
$$;

-- =============================================================================
-- 2. Compatibility scoring
-- =============================================================================

-- Weights live in a table so they can be retuned without a migration.
create table if not exists public.compatibility_weights (
  dimension text primary key,
  weight numeric not null check (weight >= 0),
  is_active boolean not null default true
);

insert into public.compatibility_weights (dimension, weight) values
  ('timeline',        18),
  ('intent',          18),
  ('wants_children',  14),
  ('conflict',        14),
  ('introspection',   12),
  ('core_value',      10),
  ('social',           8),
  ('has_children',     6),
  -- Not a dimension: the strength of the neutral prior. See compatibility_score.
  ('prior_strength',  30)
on conflict (dimension) do nothing;

-- Per-dimension agreement in 0..1, emitted only for dimensions where BOTH
-- members answered. Score and reasons are both built on this, so they can never
-- disagree with each other.
--
-- The treatments differ on purpose: timeline and introspection are ordinal
-- (distance matters), the rest are affinity matrices where plain equality would
-- be wrong — Security and Freedom are a real tension, and "Talk immediately"
-- against "Process internally" is the pursue/withdraw pattern.
create or replace function public.trait_subscores(p_a uuid, p_b uuid)
returns table (dimension text, subscore numeric, a_code text, b_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.profile_traits%rowtype;
  b public.profile_traits%rowtype;

  -- Ordinal positions. "Open-ended" is deliberately absent: it is not a point
  -- on the speed axis, so it is scored as broadly compatible instead.
  timeline_rank constant jsonb := '{"immediate":0,"within_year":1,"slow":2}'::jsonb;
  introspection_rank constant jsonb := '{"vital":0,"important":1,"occasional":2,"not_priority":3}'::jsonb;

  ra numeric;
  rb numeric;
begin
  select * into a from public.profile_traits where profile_id = p_a;
  select * into b from public.profile_traits where profile_id = p_b;

  if a.profile_id is null or b.profile_id is null then
    return;
  end if;

  -- Timeline ------------------------------------------------------------------
  if a.timeline_code is not null and b.timeline_code is not null then
    if a.timeline_code = 'open' or b.timeline_code = 'open' then
      subscore := case when a.timeline_code = b.timeline_code then 1.0 else 0.6 end;
    else
      ra := (timeline_rank ->> a.timeline_code)::numeric;
      rb := (timeline_rank ->> b.timeline_code)::numeric;
      subscore := 1.0 - (abs(ra - rb) / 2.0);
    end if;
    dimension := 'timeline'; a_code := a.timeline_code; b_code := b.timeline_code;
    return next;
  end if;

  -- Intent --------------------------------------------------------------------
  if a.intent_code is not null and b.intent_code is not null then
    subscore := case
      when a.intent_code = b.intent_code then 1.0
      when a.intent_code in ('partnership','family') and b.intent_code in ('partnership','family') then 0.9
      when 'self' in (a.intent_code, b.intent_code) then 0.3
      when 'friendship' in (a.intent_code, b.intent_code)
       and 'family' in (a.intent_code, b.intent_code) then 0.4
      else 0.5
    end;
    dimension := 'intent'; a_code := a.intent_code; b_code := b.intent_code;
    return next;
  end if;

  -- Wants children ------------------------------------------------------------
  if a.wants_children_code is not null and b.wants_children_code is not null then
    subscore := case
      when a.wants_children_code = b.wants_children_code then 1.0
      when 'maybe' in (a.wants_children_code, b.wants_children_code) then 0.7
      else 0.0
    end;
    dimension := 'wants_children';
    a_code := a.wants_children_code; b_code := b.wants_children_code;
    return next;
  end if;

  -- Conflict style ------------------------------------------------------------
  if a.conflict_code is not null and b.conflict_code is not null then
    subscore := case
      when a.conflict_code = b.conflict_code then 1.0
      when 'talk_now' in (a.conflict_code, b.conflict_code)
       and 'internal' in (a.conflict_code, b.conflict_code) then 0.2
      when 'mediation' in (a.conflict_code, b.conflict_code) then 0.7
      when 'space_then_talk' in (a.conflict_code, b.conflict_code)
       and 'internal' in (a.conflict_code, b.conflict_code) then 0.75
      when 'space_then_talk' in (a.conflict_code, b.conflict_code)
       and 'talk_now' in (a.conflict_code, b.conflict_code) then 0.6
      else 0.6
    end;
    dimension := 'conflict'; a_code := a.conflict_code; b_code := b.conflict_code;
    return next;
  end if;

  -- Introspection -------------------------------------------------------------
  if a.introspection_code is not null and b.introspection_code is not null then
    ra := (introspection_rank ->> a.introspection_code)::numeric;
    rb := (introspection_rank ->> b.introspection_code)::numeric;
    subscore := 1.0 - (abs(ra - rb) / 3.0);
    dimension := 'introspection';
    a_code := a.introspection_code; b_code := b.introspection_code;
    return next;
  end if;

  -- Core value ----------------------------------------------------------------
  if a.core_value_code is not null and b.core_value_code is not null then
    subscore := case
      when a.core_value_code = b.core_value_code then 1.0
      when 'security' in (a.core_value_code, b.core_value_code)
       and 'freedom' in (a.core_value_code, b.core_value_code) then 0.35
      when 'integrity' in (a.core_value_code, b.core_value_code)
       and 'community' in (a.core_value_code, b.core_value_code) then 0.8
      when 'creativity' in (a.core_value_code, b.core_value_code)
       and 'freedom' in (a.core_value_code, b.core_value_code) then 0.85
      else 0.6
    end;
    dimension := 'core_value'; a_code := a.core_value_code; b_code := b.core_value_code;
    return next;
  end if;

  -- Social energy -------------------------------------------------------------
  if a.social_code is not null and b.social_code is not null then
    subscore := case
      when a.social_code = b.social_code then 1.0
      when 'ambivert' in (a.social_code, b.social_code) then 0.8
      when 'introvert' in (a.social_code, b.social_code)
       and 'extrovert' in (a.social_code, b.social_code) then 0.45
      when 'selective' in (a.social_code, b.social_code)
       and 'introvert' in (a.social_code, b.social_code) then 0.85
      when 'selective' in (a.social_code, b.social_code)
       and 'extrovert' in (a.social_code, b.social_code) then 0.6
      else 0.7
    end;
    dimension := 'social'; a_code := a.social_code; b_code := b.social_code;
    return next;
  end if;

  -- Has children --------------------------------------------------------------
  if a.has_children_code is not null and b.has_children_code is not null then
    subscore := case
      when a.has_children_code = b.has_children_code then 1.0
      when 'yes_dependent' in (a.has_children_code, b.has_children_code)
       and 'yes_independent' in (a.has_children_code, b.has_children_code) then 0.8
      else 0.6
    end;
    dimension := 'has_children';
    a_code := a.has_children_code; b_code := b.has_children_code;
    return next;
  end if;

  return;
end;
$$;

-- Weighted mean over the dimensions both members answered, shrunk toward a
-- neutral 0.5 prior.
--
-- The shrinkage is the point. A plain weighted mean lets someone who answered a
-- single question that happens to agree score a perfect 1.0 and outrank a member
-- who is genuinely aligned across six dimensions. Adding a pseudo-weight of
-- neutral evidence means confidence has to be earned: little evidence stays near
-- 0.5, and a strong score requires broad agreement. It also gives members who
-- have not finished the Ritual a fair neutral rather than a zero.
--
-- prior_strength is tunable from compatibility_weights; higher means more
-- conservative.
create or replace function public.compatibility_score(p_a uuid, p_b uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with prior as (
    select coalesce(
      (
        select weight
        from public.compatibility_weights
        where dimension = 'prior_strength' and is_active
      ),
      30
    ) as k
  ),
  evidence as (
    select
      coalesce(sum(s.subscore * w.weight), 0) as weighted,
      coalesce(sum(w.weight), 0) as total
    from public.trait_subscores(p_a, p_b) s
    join public.compatibility_weights w
      on w.dimension = s.dimension and w.is_active
  )
  select coalesce(
    (evidence.weighted + prior.k * 0.5) / nullif(evidence.total + prior.k, 0),
    0.5
  )
  from evidence
  cross join prior;
$$;

-- The member-facing explanation. This is the payoff for answering the Ritual,
-- so it names the specific thing shared rather than reporting a percentage.
create or replace function public.compatibility_reasons(
  p_a uuid,
  p_b uuid,
  p_limit integer default 3
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(reason order by priority), array[]::text[])
  from (
    select
      case s.dimension
        when 'wants_children' then
          case s.a_code
            when 'yes' then 'Both want children'
            when 'no'  then 'Neither wants more children'
            else 'Open to children together'
          end
        when 'timeline' then 'Similar timelines'
        when 'intent' then
          case s.a_code
            when 'partnership' then 'Both seeking a life partnership'
            when 'family'      then 'Both building a family foundation'
            when 'friendship'  then 'Both seeking deep friendship'
            else 'Same intent'
          end
        when 'core_value' then
          'Both value ' || initcap(s.a_code)
        when 'conflict' then 'Compatible conflict styles'
        when 'introspection' then
          case when s.a_code in ('vital','important')
               then 'Both prize introspection'
               else 'Similar reflective style' end
        when 'social' then 'Similar social energy'
        when 'has_children' then 'Similar family stage'
      end as reason,
      -- Surface the things people actually decide on first.
      case s.dimension
        when 'wants_children' then 1
        when 'intent'         then 2
        when 'timeline'       then 3
        when 'core_value'     then 4
        when 'conflict'       then 5
        when 'introspection'  then 6
        when 'has_children'   then 7
        else 8
      end as priority
    from public.trait_subscores(p_a, p_b) s
    where s.subscore >= 0.85
      and s.a_code = s.b_code
    order by priority
    limit greatest(coalesce(p_limit, 3), 0)
  ) picked
  where reason is not null;
$$;

-- =============================================================================
-- 3. Discovery
-- =============================================================================

-- The only two hard gates. Everything else is ranking, because filters multiply
-- and an over-filtered gallery on a small member base is just an empty one.
--
--   * gender interest must be reciprocal — the previous filter checked only one
--     direction, so members were shown people who could never like them back
--   * "Yes, absolutely" against "No, my family is complete" is the one answer
--     pair no amount of chemistry resolves
--
-- Unanswered questions never exclude anybody: a null compares as "not a known
-- conflict", so incomplete profiles stay eligible.
create or replace function public.is_mutually_eligible(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (a.seeking_gender is null or b.gender = a.seeking_gender)
    and (b.seeking_gender is null or a.gender = b.seeking_gender)
    and (
      (
        (ta.wants_children_code = 'yes' and tb.wants_children_code = 'no')
        or (ta.wants_children_code = 'no' and tb.wants_children_code = 'yes')
      ) is not true
    ),
    false
  )
  from public.profiles a
  cross join public.profiles b
  left join public.profile_traits ta on ta.profile_id = a.id
  left join public.profile_traits tb on tb.profile_id = b.id
  where a.id = p_a
    and b.id = p_b;
$$;

-- Return type gains alignment_reasons, and create or replace cannot widen a
-- function's result — so the old one has to go first.
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
      case when p.created_at >= now() - interval '7 days' then 1.25 else 1.0 end as freshness
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
  -- alias from inside an expression; here score/freshness are input columns, so
  -- the score is computed once per candidate rather than twice.
  --
  -- Reciprocity first, then sampling weighted by compatibility
  -- (Efraimidis-Spirakis). Sampling rather than a strict ranking keeps the same
  -- few faces from being shown to everybody and lets the tail surface.
  candidates as (
    select eligible.*
    from eligible
    order by
      eligible.liked_me desc,
      -ln(random()) / greatest(eligible.score * eligible.freshness, 0.01)
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

-- =============================================================================
-- 4. The boundary gate
-- =============================================================================

create table if not exists public.match_boundary_acks (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, profile_id)
);

alter table public.match_boundary_acks enable row level security;

drop policy if exists "match_boundary_acks_select_own" on public.match_boundary_acks;
create policy "match_boundary_acks_select_own"
on public.match_boundary_acks
for select
to authenticated
using (profile_id = public.current_profile_id());

-- Records that you have read the other person's stated boundary. Writes go
-- through here rather than an RLS insert policy so the match participation
-- check cannot be skipped.
create or replace function public.acknowledge_boundary(p_match_id uuid)
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

  insert into public.match_boundary_acks (match_id, profile_id)
  values (p_match_id, v_profile_id)
  on conflict (match_id, profile_id) do nothing;
end;
$$;

-- Sending now requires having acknowledged the partner's boundary. Everything
-- else about this function is unchanged.
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

-- get_matches gains the partner's boundary and whether you have acknowledged
-- it, so the Parlor can gate the composer. Return type change, so drop first.
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

-- =============================================================================
-- 5. Grants
-- =============================================================================

revoke execute on function public.sync_profile_traits(uuid) from public, anon, authenticated;
revoke execute on function public.trait_subscores(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.compatibility_score(uuid, uuid) from public;
revoke execute on function public.compatibility_reasons(uuid, uuid, integer) from public;
revoke execute on function public.get_gallery_profiles(integer) from public;
revoke execute on function public.get_matches() from public;
revoke execute on function public.acknowledge_boundary(uuid) from public;
revoke execute on function public.send_match_message(uuid, text) from public;

grant execute on function public.get_gallery_profiles(integer) to authenticated;
grant execute on function public.get_matches() to authenticated;
grant execute on function public.acknowledge_boundary(uuid) to authenticated;
grant execute on function public.send_match_message(uuid, text) to authenticated;

-- Only ever called from the security-definer functions above. Leaving it
-- callable would let a member probe eligibility for arbitrary profile pairs.
revoke execute on function public.is_mutually_eligible(uuid, uuid) from public, anon, authenticated;

-- Read-only reference data the client may need for display.
grant select on public.ritual_answer_codes to authenticated;
