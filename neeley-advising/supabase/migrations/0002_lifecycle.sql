-- Advisor request lifecycle and section-data uploads. NOT applied automatically.
-- The app works without this migration (it falls back to memory for uploads and keeps the
-- advisor log inside advisor_requests.packet); applying it makes uploads durable.

-- 1. Allowed statuses for advisor requests (keeps the original 'requested' for meetings and call-backs).
alter table public.advisor_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.advisor_requests
  drop constraint if exists advisor_requests_status_check;
alter table public.advisor_requests
  add constraint advisor_requests_status_check
  check (status in ('draft', 'requested', 'review_requested', 'needs_info', 'reviewed', 'superseded'));

create index if not exists advisor_requests_status_idx on public.advisor_requests (status, created_at desc);

-- 2. Section data uploaded by advisors or the registrar. Stored for review; plans do not read it yet.
create table if not exists public.data_uploads (
  id uuid primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('sections')),
  source text not null,
  row_count int not null,
  rows jsonb not null,
  status text not null default 'stored_unverified'
);

alter table public.data_uploads enable row level security;
-- No policies: only the server's service role key can read or write.
