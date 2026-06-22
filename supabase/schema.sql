create table if not exists public.drumo_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.drumo_state enable row level security;
revoke all on table public.drumo_state from anon, authenticated;

comment on table public.drumo_state is
  'Persistent server-side state for the Drumo API. Access is restricted to the service role.';
