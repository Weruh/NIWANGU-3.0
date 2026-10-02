# Niwangu Supabase backend

Apply **every migration in `migrations/`, in filename order**. Older migrations
are intentionally superseded by later ones. The October 2026 migrations require
the existing payment, matching, chat-pagination, and boost migrations.

The `development` work is local and must not be pushed, merged, or deployed until
the owner approves the tested experience. The October 1 migrations were applied
to the linked production project on October 2, 2026 with owner approval.
The updated Edge Functions still need deployment before frontend release.

## Member experience

- Free members have ten total Like/Pass decisions per Africa/Nairobi calendar day.
- Browsing, photo reads, opening profiles, and changing discovery modes are unmetered.
- Discovery pauses when the decision allowance is exhausted. Matched chat remains free.
- `get_discovery_profiles()` backs Discover, Focus, Likes You, and saved profiles.
- Premium unlocks unlimited decisions, Likes You, advanced filters, last-Pass undo,
  incognito, and two 30-minute boosts per 30 purchased days (minimum one per pass).
- Mutual likes create one match. Reciprocal likes are serialized to avoid missed matches.
- Acknowledging a partner's boundary is required before messaging.
- Blocks hide the pair from discovery/inbox and prevent further messages.
- Reports enter a moderator queue; ordinary members cannot access that queue.

## Auth and functions

Configure the website URL and allow its `/?recovery=1` redirect in Supabase Auth.
Keep email confirmation enabled for production. The frontend supports confirmation
and password recovery rather than bypassing those controls.

Deploy these functions together **after approval**:

- `paystack-charge`: authenticates the caller and charges the database price.
- `paystack-webhook`: requires HMAC signature plus successful provider verification
  bound to the reference and KES currency. A verification outage returns a retryable
  response and never grants access from the payload alone.
- `delete-account`: validates the member, revokes sessions, removes photos, then
  deletes their Auth account and cascading profile data.

Required secrets: `PAYSTACK_SECRET_KEY`, `ALLOWED_ORIGINS`. Supabase provides the
project URL/service key to functions. Never put service keys in frontend variables.

Set a trusted moderator's Auth **app_metadata** role to `moderator` or `admin`
through an administrative tool. Never use user_metadata for authorization. The
moderator queue appears in Profile for that role and supports review, resolution,
and member suspension. Assign an actual team member before accepting reports in production.

## Verification without Docker

SQL regression suites are transactional and roll back synthetic fixtures:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/member_experience.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/payments_and_moderation.sql
```

For an empty isolated PostgreSQL database, run
`TEST_DATABASE_URL=postgresql://... bash scripts/check-db.sh`. This loads the minimal
Auth/Storage test interfaces, applies every migration, and runs both SQL suites.
The interfaces are test fixtures, not evidence of live Supabase Auth/Storage behaviour.
Never run fixture tests against production.

Mocked webhook tests and edge-function type checks:

```sh
npx deno test --allow-env tests/webhook_test.ts tests/delete_account_test.ts
npx deno check functions/paystack-charge/index.ts functions/paystack-webhook/index.ts functions/delete-account/index.ts
```

These tests mock provider, Auth and Storage responses; they do not move money or
delete real accounts.
Real email delivery, Storage, Realtime, account deletion, and Paystack test-mode
completion must still be verified against a staging Supabase project before release.
