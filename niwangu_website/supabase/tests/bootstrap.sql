-- Minimal Auth/Storage interfaces for an EMPTY, isolated Postgres test database.
-- This harness tests application SQL; it does not replace Supabase integration tests.
\set ON_ERROR_STOP on
do $$ begin
  if to_regclass('public.profiles') is not null or to_regclass('auth.users') is not null then
    raise exception 'Use an empty isolated test database';
  end if;
end $$;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create publication supabase_realtime;
create schema auth;
create schema storage;
create table auth.users (
  id uuid primary key, email text,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
$$;
grant usage on schema auth, storage, public to anon, authenticated, service_role;
-- Match Supabase's API-role defaults so RLS and profile guards are exercised.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
