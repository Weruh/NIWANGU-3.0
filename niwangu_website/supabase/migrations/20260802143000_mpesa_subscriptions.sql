-- Add subscription expiration & M-Pesa payment fields to profiles table
alter table public.profiles
  add column if not exists subscription_plan text default 'free',
  add column if not exists premium_expires_at timestamptz null,
  add column if not exists mpesa_receipt_number text null;

-- Create payments table to track M-Pesa STK Push transactions
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  checkout_request_id text unique,
  merchant_request_id text,
  phone_number text not null,
  amount numeric not null,
  plan_id text not null,
  status text not null default 'pending',
  mpesa_receipt text,
  result_desc text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments
for select
to authenticated
using (profile_id = public.current_profile_id());

-- Update profile view lock check function to respect subscription expiration
create or replace function public.is_profile_view_locked(p_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    not (
      p.is_premium = true
      and (p.premium_expires_at is null or p.premium_expires_at > timezone('utc', now()))
    ),
    true
  )
  and (
    select count(*) >= coalesce(p.daily_swipe_limit, 5)
    from public.profile_views pv
    where pv.viewer_profile_id = p.id
      and pv.viewed_at >= now() - interval '24 hours'
  )
  from public.profiles p
  where p.id = p_profile_id;
$$;
