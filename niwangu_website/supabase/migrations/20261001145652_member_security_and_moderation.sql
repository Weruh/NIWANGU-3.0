-- Trusted moderator role is assigned through Auth app_metadata, never user_metadata.
alter table public.profiles add column if not exists is_suspended boolean not null default false;
create or replace function public.is_moderator() returns boolean language sql stable set search_path=public as $$
 select coalesce(auth.jwt()->'app_metadata'->>'role','') in ('admin','moderator');
$$;
create function public.list_report_queue()
returns table(id uuid,reported_name text,reason text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
 if public.current_profile_id() is null or not public.is_moderator() then raise exception 'Forbidden';end if;
 return query select r.id,p.full_name,r.reason,r.status,r.created_at from public.member_reports r
 left join public.profiles p on p.id=r.target_profile_id where r.status<>'resolved' order by r.created_at limit 100;
end;$$;
create function public.review_member_report(p_report uuid,p_status text,p_suspend boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if public.current_profile_id() is null or not public.is_moderator() then raise exception 'Forbidden';end if;
 if p_status not in ('reviewing','resolved') then raise exception 'Invalid status';end if;
 update public.member_reports set status=p_status where id=p_report returning target_profile_id into target;
 if not found then raise exception 'Report not found';end if;
 if p_suspend then
  update public.profiles set is_suspended=true,discovery_paused=true where id=target;
  update public.matches set status='closed',closed_at=now(),close_reason='Connection unavailable'
  where target in(profile_low_id,profile_high_id);
 end if;
end;$$;
create function public.guard_member_profile() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
  if new.is_suspended is distinct from old.is_suspended then raise exception 'Forbidden';end if;
  if new.profile_ready and (new.age is null or new.age<18 or nullif(trim(new.full_name),'') is null
   or new.gender is null or new.seeking_gender is null or nullif(trim(new.location),'') is null
   or (select count(*) from public.profile_photos where profile_id=new.id)<>3
   or (select count(distinct question_id) from public.ritual_answers where profile_id=new.id and question_id between 1 and 12 and length(trim(answer_text))>0)<>12)
  then raise exception 'Complete your answers and add three photos first';end if;
 end if;
 return new;
end;$$;
create trigger profiles_guard_member before update on public.profiles for each row execute function public.guard_member_profile();
-- A read of an unrelated pair must never reveal their block relationship.
create or replace function public.members_blocked(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.current_profile_id() in(p_a,p_b) and exists(select 1 from public.member_blocks
 where (profile_id=p_a and target_profile_id=p_b) or(profile_id=p_b and target_profile_id=p_a));
$$;
create function public.update_member_profile(p_name text,p_age integer,p_gender public.gender_type,p_seeking_gender public.gender_type,p_location text,p_intent text,p_core_value text,p_why text,p_boundary text)
returns void language plpgsql set search_path=public as $$
declare actor uuid:=public.current_profile_id();
begin
 if actor is null then raise exception 'Not authenticated';end if;
 if length(trim(p_name)) not between 2 and 100 or p_age not between 18 and 120 or length(trim(p_location)) not between 1 and 100 then raise exception 'Invalid profile details';end if;
 insert into public.ritual_answers(profile_id,question_id,answer_text) values(actor,1,p_intent),(actor,6,p_core_value),(actor,10,p_why),(actor,12,p_boundary)
 on conflict(profile_id,question_id) do update set answer_text=excluded.answer_text;
 update public.profiles set full_name=trim(p_name),age=p_age,gender=p_gender,seeking_gender=p_seeking_gender,location=trim(p_location),intent=p_intent,core_value=p_core_value,why_niwangu=p_why,boundary=p_boundary where id=actor;
end;$$;
revoke all on function public.list_report_queue() from public,anon;
revoke all on function public.review_member_report(uuid,text,boolean) from public,anon;
revoke all on function public.update_member_profile(text,integer,public.gender_type,public.gender_type,text,text,text,text,text) from public,anon;
grant execute on function public.list_report_queue(),public.review_member_report(uuid,text,boolean),public.update_member_profile(text,integer,public.gender_type,public.gender_type,text,text,text,text,text) to authenticated;

create or replace function public.get_discovery_profiles(p_section text default 'discover',p_offset integer default 0,p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender_type,location text,boundary text,intent text,core_value text,why_niwangu text,photo_url text,alignment_reasons text[],photos text[])
language plpgsql stable security definer set search_path=public as $$
declare actor uuid:=public.current_profile_id(); premium boolean;
begin
 if actor is null then raise exception 'Not authenticated'; end if;
 if p_section not in ('discover','likes','saved') then raise exception 'Invalid section'; end if;
 if exists(select 1 from public.profiles viewer where viewer.id=actor and (viewer.discovery_paused or viewer.is_suspended)) then return;end if;
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
 where p.id<>actor and p.profile_ready and not p.discovery_paused and not p.is_suspended
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
 if not exists(select 1 from public.profiles p where p.id=p_target_profile_id and p.profile_ready and not p.discovery_paused and not p.is_suspended)
 or not public.is_mutually_eligible(actor,p_target_profile_id) or public.members_blocked(actor,p_target_profile_id) then raise exception 'Profile unavailable'; end if;
 if not exists(select 1 from public.profiles where id=actor and profile_ready and not discovery_paused and not is_suspended) then raise exception 'Complete or resume your profile first'; end if;
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
  if exists(select 1 from public.profiles where id=v_sender_profile_id and is_suspended) then raise exception 'Account suspended';end if;
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

-- Removing a photo immediately removes incomplete profiles from discovery.
create function public.hide_profile_after_photo_removal() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.profiles set profile_ready=false where id=old.profile_id;return old;end;$$;
create trigger photos_hide_incomplete after delete on public.profile_photos for each row execute function public.hide_profile_after_photo_removal();
revoke all on function public.hide_profile_after_photo_removal() from public,anon,authenticated;

-- Payment activation remains service-only even on projects with broader defaults.
revoke all on function public.complete_payment(text,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.complete_payment(text,text,text,text,numeric) to service_role;
