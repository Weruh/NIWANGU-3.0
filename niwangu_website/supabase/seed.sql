insert into public.profiles (
  id,
  auth_user_id,
  full_name,
  age,
  gender,
  seeking_gender,
  location,
  intent,
  core_value,
  why_niwangu,
  boundary,
  onboarding_completed,
  profile_ready,
  is_premium
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    null,
    'Amari',
    31,
    'male',
    'female',
    'Atlanta, USA',
    'A Life Partnership',
    'Integrity',
    'Seeking depth',
    'I am no longer willing to entertain inconsistency or mixed signals.',
    true,
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    null,
    'Malik',
    28,
    'male',
    'female',
    'Nairobi, Kenya',
    'A Deep Friendship',
    'Community',
    'Tired of swiping',
    'I am no longer willing to entertain poor communication.',
    true,
    true,
    false
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    null,
    'Kwame',
    34,
    'male',
    'female',
    'Accra, Ghana',
    'A Family Foundation',
    'Integrity',
    'Seeking depth',
    'I am no longer willing to entertain dishonesty.',
    true,
    true,
    false
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    null,
    'Layla',
    30,
    'female',
    'male',
    'Johannesburg, South Africa',
    'A Life Partnership',
    'Integrity',
    'Seeking depth',
    'I am no longer willing to entertain emotional unavailability.',
    true,
    true,
    false
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    null,
    'Zuri',
    31,
    'female',
    'male',
    'Nairobi, Kenya',
    'A Family Foundation',
    'Security',
    'Seeking depth',
    'I am no longer willing to entertain inconsistency.',
    true,
    true,
    true
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    null,
    'Naomi',
    32,
    'female',
    'male',
    'Accra, Ghana',
    'A Deep Friendship',
    'Community',
    'Recommended by friend',
    'I am no longer willing to entertain mixed signals.',
    true,
    true,
    false
  )
on conflict (id) do nothing;

insert into public.profile_photos (profile_id, sort_order, public_url, storage_path)
values
  (
    '11111111-1111-1111-1111-111111111111',
    0,
    'https://images.unsplash.com/photo-1570158268183-d296b2892211?auto=format&fit=crop&w=1400&q=80',
    null
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    0,
    'https://images.unsplash.com/photo-1654155427842-a4a249bf693e?auto=format&fit=crop&w=1400&q=80',
    null
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    0,
    'https://images.unsplash.com/photo-1587064712555-6e206484699b?auto=format&fit=crop&w=1400&q=80',
    null
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    0,
    'https://images.unsplash.com/photo-1593351799227-75df2026356b?auto=format&fit=crop&w=1400&q=80',
    null
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    0,
    'https://images.unsplash.com/photo-1656473031961-9d5d9ee19f40?auto=format&fit=crop&w=1400&q=80',
    null
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    0,
    'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?auto=format&fit=crop&w=1400&q=80',
    null
  )
on conflict (profile_id, sort_order) do nothing;
