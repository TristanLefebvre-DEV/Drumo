create table if not exists public.drumo_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.drumo_state enable row level security;
revoke all on table public.drumo_state from anon, authenticated;

comment on table public.drumo_state is
  'Persistent server-side state for the Drumo API. Access is restricted to the service role.';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  local_id text,
  file_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'library_items_user_local_id_key'
  ) then
    alter table public.library_items
      add constraint library_items_user_local_id_key unique (user_id, local_id);
  end if;
end $$;

create index if not exists library_items_user_updated_idx
  on public.library_items(user_id, updated_at desc);

alter table public.library_items enable row level security;

create policy "library_items_select_own"
  on public.library_items for select
  using (auth.uid() = user_id);

create policy "library_items_insert_own"
  on public.library_items for insert
  with check (auth.uid() = user_id);

create policy "library_items_update_own"
  on public.library_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "library_items_delete_own"
  on public.library_items for delete
  using (auth.uid() = user_id);

create table if not exists public.app_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  platform text not null,
  download_url text not null,
  changelog text not null default '',
  required_update boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists app_versions_platform_created_idx
  on public.app_versions(platform, created_at desc);

alter table public.app_versions enable row level security;

create policy "app_versions_public_read"
  on public.app_versions for select
  using (true);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.library_items to authenticated;
grant select on public.app_versions to anon, authenticated;
