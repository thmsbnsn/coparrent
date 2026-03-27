# Problem Report Setup

This project’s mobile shake-to-report and manual "Report a problem" flow now submits through the Supabase edge function `submit-problem-report` and stores structured records in `public.problem_reports`.

## What Gets Created

Migrations:
- [20260327113000_add_problem_reports.sql](/E:/Files/.coparrent/supabase/migrations/20260327113000_add_problem_reports.sql)
- [20260327124500_harden_problem_reports_schema.sql](/E:/Files/.coparrent/supabase/migrations/20260327124500_harden_problem_reports_schema.sql)

Together they create and normalize:
- `public.problem_reports`
- indexes for triage and review
- RLS on `problem_reports`
- a private storage bucket named `problem-report-screenshots`
- an `updated_at` trigger using the repo’s existing `public.update_updated_at_column()`

Edge function: [submit-problem-report](/E:/Files/.coparrent/supabase/functions/submit-problem-report/index.ts)

It handles:
- optional auth-aware attribution
- optional screenshot upload
- safe report insertion
- fallback behavior if screenshot storage is unavailable

## Data Shape

Primary fields stored on each report:
- `category`
- `summary`
- `details`
- `email`
- `status`
- `route_path`
- `current_url`
- `page_title`
- `app_version`
- `user_agent`
- `viewport_width`
- `viewport_height`
- `platform_info`
- `is_pwa_standalone`
- `motion_triggered`
- `trigger_source`
- `screenshot_path`
- `screenshot_url`
- `user_id`
- `user_email`
- `client_timestamp`
- `extra_context`

Status values:
- `new`
- `reviewing`
- `resolved`
- `closed`

Category values:
- `Bug`
- `Confusing / unclear`
- `Feature request`
- `Other`

## RLS Model

The table uses a private-by-default model.

- Inserts are handled through the edge function using the service role key.
- No public read access is granted.
- Authenticated users may read only their own reports.
- Screenshot files stay in a private bucket and are uploaded server-side by the edge function.

This matches the current app architecture:
- anonymous/manual reporting is allowed through the edge function
- authenticated users are attached when a real session exists
- no client-side direct writes or public storage reads are exposed

## Required Setup

Run the database migration:

```powershell
supabase db push
```

Deploy the edge function:

```powershell
supabase functions deploy submit-problem-report
```

If you deploy functions from a linked remote project, make sure the standard Supabase function secrets already used by the repo exist there:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No new custom environment variables are required for this feature.

The follow-up hardening migration is intentionally included so older draft `problem_reports` schemas are normalized instead of being left behind.

## Storage Notes

Screenshot uploads are optional.

- If the user does not attach a screenshot, the report still submits normally.
- If the user attaches a screenshot and the private bucket is available, the image is uploaded and the private storage path is saved in `screenshot_path`.
- `screenshot_url` is intentionally left `null` right now because the bucket is private and the app does not expose public screenshot URLs.
- If storage upload fails, the report still submits and the upload failure is recorded in `extra_context`.

## Manual Dashboard Steps

There are no required Supabase dashboard clicks if you apply the migration and deploy the function from CLI.

Optional checks in the dashboard:
- verify the `problem-report-screenshots` bucket exists and is private
- verify `problem_reports` has RLS enabled
- verify the `submit-problem-report` edge function is deployed

## Admin Query Example

Use this query to review the newest reports first:

```sql
select
  id,
  created_at,
  status,
  category,
  summary,
  coalesce(user_email, email) as reporter,
  route_path,
  trigger_source
from public.problem_reports
order by created_at desc
limit 100;
```

## Type Generation

The repo has a generated Supabase types file at [types.ts](/E:/Files/.coparrent/src/integrations-supabase/types.ts).

This feature submits through an edge function, so regeneration is not required for the frontend flow to work. If you later want direct typed reads of `problem_reports`, regenerate the Supabase types after applying the migration.
