-- Supabase SQL Editor: Master schema for a simple wedding guest/RSVP table
-- Paste this into the Supabase SQL editor and run.
-- Maps to requested fields: Name, Email, Phone, Guest Count, Non-Veg, Veg, Comments, Timestamp, Actions

-- Notes
-- - Column names use snake_case and valid identifiers (no spaces or hyphens)
-- - Includes basic constraints and helpful indexes
-- - "actions" is JSONB to flexibly store audit/action entries (array of objects)
-- - "timestamp" is represented as created_at (timestamptz)
-- - Adds a CHECK that veg + non_veg <= guest_count

-- If you need UUID generation, Supabase usually has gen_random_uuid() available.
-- If not, enable extension (may already be enabled):
-- create extension if not exists pgcrypto;

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),

  -- Name
  name text not null,

  -- Email
  email text,

  -- Phone (kept as text to preserve formatting, country codes, leading zeros)
  phone text,

  -- Guest Count
  guest_count integer not null default 1 check (guest_count >= 0),

  -- Non-Veg and Veg counts
  non_veg integer not null default 0 check (non_veg >= 0),
  veg integer not null default 0 check (veg >= 0),

  -- Comments
  comments text,

  -- Timestamp
  created_at timestamptz not null default now(),

  -- Actions: JSON array of action entries, e.g., [{"type":"rsvp_submitted","at":"2025-08-22T12:34:56Z"}]
  actions jsonb not null default '[]'::jsonb,

  -- Ensure distribution doesn't exceed total guests
  constraint chk_meal_counts_total check ((non_veg + veg) <= guest_count)
);

-- Helpful indexes for lookups
create index if not exists idx_guests_email on public.guests using btree (email) where email is not null;
create index if not exists idx_guests_phone on public.guests using btree (phone) where phone is not null;
create index if not exists idx_guests_created_at on public.guests using btree (created_at);

-- Optional: if you need to search/filter by actions content
-- create index if not exists idx_guests_actions_gin on public.guests using gin (actions);

-- Optional: Add unique constraint to avoid duplicate entries by same email+phone combo
-- alter table public.guests add constraint uq_guests_email_phone unique (email, phone);

-- Comments for clarity in UI tools
comment on table public.guests is 'Guest list / RSVP records with meal preferences and notes';
comment on column public.guests.name is 'Name';
comment on column public.guests.email is 'Email';
comment on column public.guests.phone is 'Phone';
comment on column public.guests.guest_count is 'Guest Count';
comment on column public.guests.non_veg is 'Non-Veg count';
comment on column public.guests.veg is 'Veg count';
comment on column public.guests.comments is 'Comments';
comment on column public.guests.created_at is 'Timestamp when the record was created';
comment on column public.guests.actions is 'JSONB array of actions/audit events';

-- Row Level Security (RLS)
-- Supabase recommends enabling RLS, then adding explicit policies.
-- Uncomment and tailor policies to your app's auth model.
-- alter table public.guests enable row level security;

-- Example policies:
-- 1) Allow read to authenticated users
-- create policy "Authenticated can read guests"
--   on public.guests for select
--   to authenticated
--   using (true);

-- 2) Allow insert to authenticated users
-- create policy "Authenticated can insert guests"
--   on public.guests for insert
--   to authenticated
--   with check (true);

-- 3) Allow update by the record creator (requires a created_by column with auth.uid())
-- alter table public.guests add column if not exists created_by uuid;
-- update public.guests set created_by = auth.uid() where created_by is null; -- initial backfill if needed
-- create policy "Users can update own guests"
--   on public.guests for update
--   to authenticated
--   using (created_by = auth.uid())
--   with check (created_by = auth.uid());

-- If you need a simple public form (no auth), consider using Edge Functions or inserting with a service role key.

-- Simple profile table to store a single moderator credential for the dashboard
create table if not exists public.profile (
  id bigint primary key generated always as identity,
  username text not null,
  password text not null,
  updated_at timestamptz not null default now()
);

comment on table public.profile is 'Single-row table to store moderator username/password for dashboard access';
create unique index if not exists uq_profile_singleton on public.profile ((true)) where true; -- allows at most 1 row by convention
