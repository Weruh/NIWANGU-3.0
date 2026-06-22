# Niwangu Frontend

This app now uses Supabase for:

- Auth
- Postgres data
- Storage uploads
- Realtime chat refresh

## Local setup

1. Install dependencies:
   `npm install`
2. Set Supabase variables in `frontend/.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Apply the SQL backend files in your Supabase project:
   `../supabase/migrations/20260421_initial.sql`
   `../supabase/migrations/20260511_pricing_plans.sql`
   `../supabase/migrations/20260622090838_remove_seeded_dummy_profiles.sql`
4. Run the app:
   `npm run dev`

## Notes

- Registration uses Supabase Auth email/password.
- If your Supabase project requires email confirmation, new users will be sent back to the sign-in screen until they confirm their email.
