#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an empty isolated Postgres database}"
task_backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$task_backend_dir/tests/bootstrap.sql"
for migration in "$task_backend_dir"/migrations/*.sql; do
  psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$task_backend_dir/tests/member_experience.sql"
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$task_backend_dir/tests/payments_and_moderation.sql"
