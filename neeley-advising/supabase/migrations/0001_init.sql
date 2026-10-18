-- Neeley Advising: tables for requests, feedback and voice conversations.
-- All access goes through the server with the service role key. Row-level security is ON with no
-- policies, so the public (anon) key can read and write nothing.

create table if not exists public.advisor_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('meeting', 'callback', 'review')),
  status text not null default 'requested',
  contact jsonb,
  preferred_time text,
  topic text,
  packet jsonb,
  channel text
);

create table if not exists public.feedback (
  id uuid primary key,
  created_at timestamptz not null default now(),
  rating int not null check (rating between 1 and 5),
  comments text,
  would_recommend boolean,
  follow_up boolean not null default false,
  contact text
);

create table if not exists public.applications_mock (
  id uuid primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  term text,
  program text,
  note text,
  consent boolean not null
);

create table if not exists public.survey_responses (
  id uuid primary key,
  created_at timestamptz not null default now(),
  answers jsonb not null,
  knows text,
  consent boolean not null default false
);

create table if not exists public.conversations (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  channel text,
  messages jsonb not null default '[]'::jsonb
);

create table if not exists public.plans (
  id uuid primary key,
  created_at timestamptz not null default now(),
  owner text,
  status text not null default 'draft' check (status in ('draft', 'review_requested', 'needs_info', 'reviewed', 'superseded')),
  plan jsonb not null
);

alter table public.advisor_requests enable row level security;
alter table public.feedback enable row level security;
alter table public.applications_mock enable row level security;
alter table public.survey_responses enable row level security;
alter table public.conversations enable row level security;
alter table public.plans enable row level security;

create index if not exists advisor_requests_created_idx on public.advisor_requests (created_at desc);
