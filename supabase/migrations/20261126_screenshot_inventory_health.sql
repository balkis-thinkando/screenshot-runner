-- Weekly screenshot inventory scan: run log in health.sync_runs (source 'screenshots') and freshness check.
-- Applied to project pduavmiyphkoekslpeld on 26 Nov 2026.
-- The health schema is not exposed to the REST API, so the GitHub job logs runs through these functions
-- (service role only).

create or replace function public.screenshot_scan_log_start(p_trigger text, p_log_path text)
returns bigint language sql security definer set search_path = '' as $$
  insert into health.sync_runs (source, trigger, host, log_path)
  values ('screenshots', coalesce(p_trigger, 'manual'), 'github-actions', p_log_path)
  returning id;
$$;

create or replace function public.screenshot_scan_log_finish(p_id bigint, p_status text, p_summary jsonb, p_error text)
returns void language sql security definer set search_path = '' as $$
  update health.sync_runs set status = p_status, finished_at = now(), summary = p_summary, error = left(p_error, 500)
  where id = p_id and source = 'screenshots';
$$;

-- Used when the GitHub job is cancelled or times out
create or replace function public.screenshot_scan_mark_stuck_failed()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update health.sync_runs set status = 'failed', finished_at = now(), error = 'GitHub job was cancelled or timed out'
  where source = 'screenshots' and status = 'running';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.screenshot_scan_log_start(text, text) from public, anon, authenticated;
revoke execute on function public.screenshot_scan_log_finish(bigint, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.screenshot_scan_mark_stuck_failed() from public, anon, authenticated;
grant execute on function public.screenshot_scan_log_start(text, text) to service_role;
grant execute on function public.screenshot_scan_log_finish(bigint, text, jsonb, text) to service_role;
grant execute on function public.screenshot_scan_mark_stuck_failed() to service_role;

-- F01 freshness: add the screenshots inventory (warn after 8 days, error after 15, like the other sources)
create or replace view health.v_freshness as
 WITH src AS (
         SELECT 'assets_catalog'::text AS source,
            'ILT courses and modules from Assets (AUC)'::text AS description,
            LEAST(( SELECT max(ilt_courses.catalog_synced_at) AS max
                   FROM ilt_courses), ( SELECT max(ilt_modules.catalog_synced_at) AS max
                   FROM ilt_modules)) AS last_synced_at
        UNION ALL
         SELECT 'ilt_decks'::text,
            'ILT slide decks (sync_ilt_decks.py --apply)'::text,
            ( SELECT max(ilt_sync_runs.finished_at) AS max
                   FROM ilt_sync_runs
                  WHERE (ilt_sync_runs.finished_at IS NOT NULL)) AS max
        UNION ALL
         SELECT 'ilt_labs'::text,
            'ILT lab workbooks from Confluence (sync_ilt_labs.py --apply)'::text,
            ( SELECT max(ilt_lab_workbooks.synced_at) AS max
                   FROM ilt_lab_workbooks) AS max
        UNION ALL
         SELECT 'contentful'::text,
            'On-demand lessons and sections (weekly launchd job, refresh_contentful_corpus.py)'::text,
            COALESCE(( SELECT max(sync_runs.finished_at) AS max
                   FROM health.sync_runs
                  WHERE ((sync_runs.source = 'contentful'::text) AND (sync_runs.status = 'success'::text))), ( SELECT max(lessons.updated_at) AS max
                   FROM lessons)) AS "coalesce"
        UNION ALL
         SELECT 'screenshots'::text,
            'On-demand lesson screenshot inventory (weekly GitHub job in screenshot-runner)'::text,
            COALESCE(( SELECT max(sync_runs.finished_at) AS max
                   FROM health.sync_runs
                  WHERE ((sync_runs.source = 'screenshots'::text) AND (sync_runs.status = 'success'::text))), ( SELECT max(alcat_lessons.scanned_at) AS max
                   FROM alcat_lessons))
        )
 SELECT src.source,
    src.description,
    src.last_synced_at,
    date_trunc('minute'::text, (now() - src.last_synced_at)) AS age,
        CASE
            WHEN (src.last_synced_at IS NULL) THEN 'error'::text
            WHEN ((now() - src.last_synced_at) > s.stale_error_after) THEN 'error'::text
            WHEN ((now() - src.last_synced_at) > s.stale_warn_after) THEN 'warn'::text
            ELSE 'ok'::text
        END AS status
   FROM (src
     CROSS JOIN health.v_settings s);
