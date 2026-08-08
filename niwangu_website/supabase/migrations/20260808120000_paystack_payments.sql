-- Move payments from Safaricom Daraja to Paystack.
--
-- Paystack still sends the same M-Pesa STK push, but it owns the transaction
-- identity now: there is no CheckoutRequestID/MerchantRequestID pair, just a
-- single `reference` that we generate and Paystack echoes back. The columns and
-- functions are renamed to match, and are provider-neutral so a future switch
-- does not need another rename pass.
--
-- Existing Daraja rows are preserved as-is; their old ws_CO_* identifiers simply
-- live in `reference` from here on.

-- 1. Payments table ------------------------------------------------------------

-- Each rename requires the old column to be present AND the new one absent, so
-- a database where part of this was already applied by hand converges instead
-- of erroring on "column already exists".
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'checkout_request_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'reference'
  ) then
    alter table public.payments rename column checkout_request_id to reference;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'mpesa_receipt'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'provider_receipt'
  ) then
    alter table public.payments rename column mpesa_receipt to provider_receipt;
  end if;
end;
$$;

-- Paystack has no second identifier to reconcile against, but it does return a
-- numeric transaction id that is what you search for in the dashboard.
alter table public.payments
  drop column if exists merchant_request_id,
  add column if not exists provider_transaction_id text null;

alter table public.payments
  add column if not exists reference text;

-- The reference is generated before the charge call, so it is never null.
update public.payments
set reference = 'legacy_' || id::text
where reference is null;

alter table public.payments
  alter column reference set not null;

-- The rename carries the old column's unique constraint across, so only add one
-- when there genuinely isn't a unique index on `reference` already. Rename the
-- inherited constraint first so it stops naming a column that no longer exists.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = 'payments_checkout_request_id_key'
  ) then
    alter table public.payments
      rename constraint payments_checkout_request_id_key to payments_reference_key;
  end if;
  if not exists (
    select 1
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
    where n.nspname = 'public'
      and c.relname = 'payments'
      and i.indisunique
      and i.indnatts = 1
      and a.attname = 'reference'
  ) then
    create unique index payments_reference_key on public.payments (reference);
  end if;
end;
$$;

-- 2. Profiles ------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'mpesa_receipt_number'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'payment_reference'
  ) then
    alter table public.profiles rename column mpesa_receipt_number to payment_reference;
  end if;
end;
$$;

alter table public.profiles
  add column if not exists payment_reference text null;

-- The guard has to name the new column, otherwise a member could write their own
-- payment_reference from the browser.
create or replace function public.protect_profile_plan_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.is_premium is distinct from old.is_premium
      or new.daily_swipe_limit is distinct from old.daily_swipe_limit
      or new.subscription_plan is distinct from old.subscription_plan
      or new.premium_expires_at is distinct from old.premium_expires_at
      or new.payment_reference is distinct from old.payment_reference
    )
  then
    raise exception 'plan_fields_require_payment';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_plan_fields on public.profiles;
create trigger profiles_protect_plan_fields
before update on public.profiles
for each row
execute function public.protect_profile_plan_fields();

-- 3. Activation functions ------------------------------------------------------

-- Same contract as complete_mpesa_payment(): idempotent, and it verifies the
-- amount against the plan price so a replayed or forged webhook cannot extend a
-- subscription for free. p_paid_amount arrives in KES (the webhook converts from
-- Paystack's subunits) so it compares directly against price_ksh.
create or replace function public.complete_payment(
  p_reference text,
  p_provider_receipt text,
  p_provider_transaction_id text,
  p_result_desc text,
  p_paid_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_plan public.pricing_plans%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_base timestamptz;
begin
  select * into v_payment
  from public.payments
  where reference = p_reference
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_payment.status = 'completed' then
    return 'already_completed';
  end if;

  select * into v_plan
  from public.pricing_plans
  where plan_id = v_payment.plan_id;

  if not found then
    update public.payments
    set status = 'failed',
        result_desc = 'Unknown plan: ' || coalesce(v_payment.plan_id, '(null)'),
        updated_at = v_now
    where id = v_payment.id;

    return 'unknown_plan';
  end if;

  -- Paystack reports what was actually settled. Anything short of the plan price
  -- is recorded but never activated.
  if p_paid_amount is null or p_paid_amount < v_plan.price_ksh then
    update public.payments
    set status = 'amount_mismatch',
        paid_amount = p_paid_amount,
        provider_receipt = p_provider_receipt,
        provider_transaction_id = p_provider_transaction_id,
        result_desc = format(
          'Paid %s but plan %s costs %s',
          coalesce(p_paid_amount::text, 'nothing'),
          v_plan.plan_id,
          v_plan.price_ksh
        ),
        updated_at = v_now
    where id = v_payment.id;

    return 'amount_mismatch';
  end if;

  update public.payments
  set status = 'completed',
      paid_amount = p_paid_amount,
      provider_receipt = p_provider_receipt,
      provider_transaction_id = p_provider_transaction_id,
      result_desc = p_result_desc,
      completed_at = v_now,
      updated_at = v_now
  where id = v_payment.id;

  -- Renewing early stacks onto the remaining time instead of discarding it.
  select greatest(coalesce(p.premium_expires_at, v_now), v_now)
  into v_base
  from public.profiles p
  where p.id = v_payment.profile_id;

  update public.profiles
  set is_premium = true,
      subscription_plan = v_plan.plan_id,
      premium_expires_at = v_base + make_interval(days => v_plan.duration_days),
      payment_reference = coalesce(p_provider_receipt, p_reference)
  where id = v_payment.profile_id;

  return 'activated';
end;
$$;

create or replace function public.fail_payment(
  p_reference text,
  p_result_desc text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment
  from public.payments
  where reference = p_reference
  for update;

  if not found then
    return 'not_found';
  end if;

  -- Never walk back a completed payment.
  if v_payment.status = 'completed' then
    return 'already_completed';
  end if;

  update public.payments
  set status = 'failed',
      result_desc = p_result_desc,
      updated_at = timezone('utc', now())
  where id = v_payment.id;

  return 'failed';
end;
$$;

-- These are the activation path: only the webhook (service_role) may call them.
revoke execute on function public.complete_payment(text, text, text, text, numeric) from public;
revoke execute on function public.complete_payment(text, text, text, text, numeric) from anon, authenticated;
revoke execute on function public.fail_payment(text, text) from public;
revoke execute on function public.fail_payment(text, text) from anon, authenticated;
grant execute on function public.complete_payment(text, text, text, text, numeric) to service_role;
grant execute on function public.fail_payment(text, text) to service_role;

-- 4. Retire the Daraja entry points --------------------------------------------

drop function if exists public.complete_mpesa_payment(text, text, text, numeric);
drop function if exists public.fail_mpesa_payment(text, text);
