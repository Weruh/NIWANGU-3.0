# Niwangu Frontend

This app uses Supabase for:

- Auth
- Postgres data
- Storage uploads
- Realtime chat refresh
- M-Pesa payments through Paystack, via two edge functions

## Local setup

1. Install dependencies:
   `npm install`
2. Set Supabase variables in `frontend/.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Apply every migration in `../supabase/migrations` **in filename order** —
   later files redefine functions and policies from earlier ones:

```bash
supabase db push
```

4. Run the app:
   `npm run dev`

To reach the dev server through a tunnel, list the host explicitly:

```bash
DEV_ALLOWED_HOSTS=your-tunnel.ngrok-free.dev npm run dev
```

## Scripts

- `npm run dev` — dev server on port 3000
- `npm run typecheck` — TypeScript, no emit (also part of `build`, and gated in CI)
- `npm run build` — typecheck, then production build to `dist/`

## Payments

Prices live in the `pricing_plans` table, not in the frontend. `lib/plans.ts`
holds the marketing copy and reads prices at runtime, so the UI cannot quote a
price the server won't charge.

Payments run on Paystack's Charge API. The member still types a Safaricom
number and approves an STK push — Paystack sends that prompt instead of Daraja.

- `paystack-charge` authenticates the member from their JWT, reads the price from
  `pricing_plans`, writes a `pending` row to `payments`, then charges Paystack.
  The row is written *before* the charge because we generate the reference and
  the webhook can arrive while the charge call is still returning.
- `paystack-webhook` verifies the `x-paystack-signature` HMAC, re-verifies the
  transaction against Paystack, and only then calls `complete_payment()`.

Premium is granted **only** by `complete_payment()`. The browser cannot set
`is_premium`, `premium_expires_at`, `subscription_plan`, or `payment_reference` —
a trigger rejects those writes.

Set these secrets on the Supabase project before taking real payments:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_... ALLOWED_ORIGINS=https://niwangu.com
```

The same key both authorises charges and verifies webhook signatures, so it must
be the key for the environment the webhook is registered in — a `sk_test_` key
cannot validate a live webhook.

Register the webhook URL in the Paystack dashboard under **Settings → API Keys &
Webhooks**:

```
https://<project-ref>.supabase.co/functions/v1/paystack-webhook
```

Without `PAYSTACK_SECRET_KEY` both functions fail closed. To exercise the flow
locally, use your `sk_test_` key: test-mode charges complete without moving
money, and premium is still only activated by a real signed webhook.

## Notes

- Registration uses Supabase Auth email/password.
- If your Supabase project requires email confirmation, new users will be sent
  back to the sign-in screen until they confirm their email.
- Other members' profiles are readable only through `get_gallery_profiles()` and
  `get_matches()`, which meter the free daily view limit. Querying the `profiles`
  table directly returns your own row and nothing else.
