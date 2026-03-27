create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  category text not null,
  summary text not null,
  details text not null,
  email text,
  route_path text not null,
  current_url text not null,
  page_title text,
  client_timestamp timestamptz,
  app_version text,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  platform_info text,
  is_pwa_standalone boolean,
  motion_triggered boolean not null default false,
  trigger_source text not null default 'manual',
  screenshot_path text,
  screenshot_url text,
  extra_context jsonb not null default '{}'::jsonb,
  status text not null default 'new'
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'source'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'trigger_source'
  ) then
    alter table public.problem_reports rename column source to trigger_source;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'contact_email'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'email'
  ) then
    alter table public.problem_reports rename column contact_email to email;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'page_url'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'current_url'
  ) then
    alter table public.problem_reports rename column page_url to current_url;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'platform'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'platform_info'
  ) then
    alter table public.problem_reports rename column platform to platform_info;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'is_standalone'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'is_pwa_standalone'
  ) then
    alter table public.problem_reports rename column is_standalone to is_pwa_standalone;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'metadata'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_reports'
      and column_name = 'extra_context'
  ) then
    alter table public.problem_reports rename column metadata to extra_context;
  end if;
end $$;

alter table public.problem_reports
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists page_title text,
  add column if not exists motion_triggered boolean not null default false,
  add column if not exists screenshot_url text,
  add column if not exists extra_context jsonb not null default '{}'::jsonb,
  add column if not exists email text,
  add column if not exists current_url text,
  add column if not exists platform_info text,
  add column if not exists is_pwa_standalone boolean,
  add column if not exists trigger_source text not null default 'manual';

update public.problem_reports
set
  category = case category
    when 'bug' then 'Bug'
    when 'confusing' then 'Confusing / unclear'
    when 'feature_request' then 'Feature request'
    when 'other' then 'Other'
    else category
  end,
  status = case status
    when 'triaged' then 'reviewing'
    else status
  end,
  motion_triggered = coalesce(motion_triggered, trigger_source = 'shake'),
  extra_context = coalesce(extra_context, '{}'::jsonb)
where
  category in ('bug', 'confusing', 'feature_request', 'other')
  or status = 'triaged'
  or extra_context is null
  or motion_triggered is null;

alter table public.problem_reports
  alter column updated_at set default now(),
  alter column extra_context set default '{}'::jsonb,
  alter column extra_context set not null,
  alter column trigger_source set default 'manual',
  alter column motion_triggered set default false,
  alter column is_pwa_standalone drop not null;

alter table public.problem_reports
  drop constraint if exists problem_reports_source_check,
  drop constraint if exists problem_reports_trigger_source_check,
  drop constraint if exists problem_reports_category_check,
  drop constraint if exists problem_reports_status_check;

alter table public.problem_reports
  add constraint problem_reports_trigger_source_check
    check (trigger_source in ('manual', 'shake')),
  add constraint problem_reports_category_check
    check (category in ('Bug', 'Confusing / unclear', 'Feature request', 'Other')),
  add constraint problem_reports_status_check
    check (status in ('new', 'reviewing', 'resolved', 'closed'));

alter table public.problem_reports enable row level security;

drop trigger if exists update_problem_reports_updated_at on public.problem_reports;
create trigger update_problem_reports_updated_at
  before update on public.problem_reports
  for each row
  execute function public.update_updated_at_column();

create index if not exists idx_problem_reports_created_at
  on public.problem_reports (created_at desc);

create index if not exists idx_problem_reports_user_id
  on public.problem_reports (user_id);

create index if not exists idx_problem_reports_status
  on public.problem_reports (status);

create index if not exists idx_problem_reports_trigger_source
  on public.problem_reports (trigger_source);

drop policy if exists "Users can view their own problem reports" on public.problem_reports;
create policy "Users can view their own problem reports"
  on public.problem_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'problem-report-screenshots',
  'problem-report-screenshots',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
