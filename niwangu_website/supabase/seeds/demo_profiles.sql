-- DEMO DATA — not a migration. Nothing here runs during `supabase db push`.
--
-- Creates a handful of viewable members aimed at whichever account signed in
-- most recently, so the gallery, swiping, matching and the Parlor can all be
-- exercised end to end. Every row is tagged with a boundary of 'demo-seed' so
-- it can be removed again; see the cleanup block at the bottom.
--
-- Run it against a development project. If you run it against production you
-- are putting fake members in front of real users.

do $$
declare
  v_me public.profiles%rowtype;
  v_shows public.gender_type;
  v_seeks public.gender_type;
  v_new_id uuid;
  v_names text[] := array['Amina', 'Zawadi', 'Nia', 'Halima', 'Neema', 'Sanaa'];
  v_intents text[] := array[
    'A serious relationship', 'Marriage, eventually', 'Something slow and real',
    'A partnership of equals', 'Long-term commitment', 'Depth over speed'
  ];
  v_values text[] := array[
    'Honesty', 'Kindness', 'Loyalty', 'Curiosity', 'Patience', 'Generosity'
  ];
  v_photos text[] := array[
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
    'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800'
  ];
  i integer;
begin
  select p.* into v_me
  from public.profiles p
  join auth.users u on u.id = p.auth_user_id
  order by u.last_sign_in_at desc nulls last
  limit 1;

  if v_me.id is null then
    raise exception 'No profile is linked to any auth user. Sign up in the app first.';
  end if;

  -- Match the seeded members to what this account is actually looking for,
  -- otherwise get_gallery_profiles filters every one of them out.
  v_shows := coalesce(v_me.seeking_gender, 'female');
  v_seeks := coalesce(v_me.gender, 'male');

  for i in 1..array_length(v_names, 1) loop
    insert into public.profiles (
      full_name, age, gender, seeking_gender, location,
      intent, core_value, why_niwangu, boundary,
      onboarding_completed, profile_ready
    )
    values (
      v_names[i], 24 + i, v_shows, v_seeks, 'Nairobi',
      v_intents[i], v_values[i],
      'To meet someone who values depth over speed.',
      'demo-seed: I move slowly and say what I mean.',
      true, true
    )
    returning id into v_new_id;

    insert into public.profile_photos (profile_id, public_url, sort_order, storage_path)
    values (v_new_id, v_photos[i], 0, null);

    -- Every second one already liked you, so liking back creates an instant
    -- match and a conversation appears in the Parlor.
    if i % 2 = 0 then
      insert into public.swipes (actor_profile_id, target_profile_id, direction)
      values (v_new_id, v_me.id, 'like')
      on conflict (actor_profile_id, target_profile_id) do nothing;
    end if;
  end loop;

  raise notice 'Seeded % demo members (gender %) for %.',
    array_length(v_names, 1), v_shows, coalesce(v_me.full_name, 'your account');
end
$$;

-- Clears the daily view allowance so the seeded members are visible right away.
delete from public.profile_views
where viewer_profile_id in (
  select p.id from public.profiles p
  join auth.users u on u.id = p.auth_user_id
);

-- ---------------------------------------------------------------------------
-- Cleanup: removes every demo member and anything that references them.
-- ---------------------------------------------------------------------------
-- delete from public.profiles where boundary like 'demo-seed:%';
