# Niwangu

React/Vite frontend, Supabase Auth/Postgres/Storage/Realtime, and Paystack M-Pesa payments.

## Run locally

```bash
npm ci --prefix niwangu_website/frontend
npm ci --prefix niwangu_website/supabase
cp niwangu_website/frontend/.env.example niwangu_website/frontend/.env.local
# Set your Supabase project URL and browser key in .env.local.
npm --prefix niwangu_website/frontend run dev
```

Local environment files, CLI linking state, dependencies, builds, and caches are ignored by Git.
The canonical logo is `niwangu_website/frontend/public/niwangu-logo.png`.

## Validate

```bash
npm --prefix niwangu_website/frontend run build
cd niwangu_website/supabase
node_modules/.bin/deno check functions/paystack-charge/index.ts functions/paystack-webhook/index.ts functions/delete-account/index.ts
node_modules/.bin/deno test --allow-env tests/webhook_test.ts tests/delete_account_test.ts
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niwangu_test bash scripts/check-db.sh
```

The SQL runner requires an **empty isolated database**. Never point it at production.
Pull requests run the frontend build, Edge Function checks/tests, and every migration plus SQL regression suites.

## Release to main

1. Push the prepared branch with `git push -u origin development`, then open a
   pull request from `development` to `main` and let **Release checks** pass.
2. Before publishing the new frontend, deploy the tested backend functions from the repository root:

   ```bash
   niwangu_website/supabase/node_modules/.bin/supabase functions deploy paystack-charge --project-ref rgfeuirsxhexmvgeigie --workdir niwangu_website
   niwangu_website/supabase/node_modules/.bin/supabase functions deploy paystack-webhook --project-ref rgfeuirsxhexmvgeigie --workdir niwangu_website
   niwangu_website/supabase/node_modules/.bin/supabase functions deploy delete-account --project-ref rgfeuirsxhexmvgeigie --workdir niwangu_website
   ```

   Confirm production `PAYSTACK_SECRET_KEY` and `ALLOWED_ORIGINS` include `https://niwangu.com`.
   The October 1 migrations were applied to this project on October 2, 2026.
   Read-only inspection on that date found older payment functions and no `delete-account` deployment.
3. Merge the approved pull request. **Deploy GitHub Pages** builds `main` and publishes `niwangu.com`.
   The repository already has the required frontend URL and publishable-key secrets.
4. Verify live login, Focus, locked/free Discover, Premium Discover, messaging, and account settings.

Detailed setup: [frontend](niwangu_website/frontend/README.md), [backend](niwangu_website/supabase/README.md).
