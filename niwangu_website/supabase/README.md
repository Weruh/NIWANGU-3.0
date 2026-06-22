# Supabase Backend

Apply the SQL files in this order inside your Supabase project SQL editor:

1. `supabase/migrations/20260421_initial.sql`
2. `supabase/migrations/20260511_pricing_plans.sql`
3. `supabase/migrations/20260622090838_remove_seeded_dummy_profiles.sql`
4. `supabase/migrations/20260622094233_enforce_profile_view_paywall.sql`
5. `supabase/migrations/20260622111251_fix_sticky_gallery_profile.sql`

Then set these frontend environment variables in `frontend/.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Recommended Supabase dashboard settings:

- Authentication: disable email confirmation if you want registration to continue directly into the onboarding flow.
- Realtime: keep the default `supabase_realtime` publication enabled.
- Storage: the migration creates a public `profile-photos` bucket and the required policies.
