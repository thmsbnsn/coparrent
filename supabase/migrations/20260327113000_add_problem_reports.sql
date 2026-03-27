create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  category text not null check (category in ('Bug', 'Confusing / unclear', 'Feature request', 'Other')),
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
  trigger_source text not null default 'manual' check (trigger_source in ('manual', 'shake')),
  screenshot_path text,
  screenshot_url text,
  extra_context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'closed'))
);

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
