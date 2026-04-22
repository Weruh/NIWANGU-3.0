# Supabase Backend

Apply the SQL files in this order inside your Supabase project SQL editor:

1. `supabase/migrations/20260421_initial.sql`
2. `supabase/seed.sql`

Then set these frontend environment variables in `frontend/.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Recommended Supabase dashboard settings:

- Authentication: disable email confirmation if you want registration to continue directly into the onboarding flow.
- Realtime: keep the default `supabase_realtime` publication enabled.
- Storage: the migration creates a public `profile-photos` bucket and the required policies.
