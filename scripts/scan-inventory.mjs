// Rebuilds the screenshot inventory (public.lesson_screenshots and public.alcat_lessons) by calling the
// Edge Function scan-lesson-screenshots one batch at a time, then removes lessons that no longer exist.
// The run is logged in health.sync_runs (source "screenshots"), so a failed or stuck run shows in the
// health checks (F05) and a missing run in F01 after 8 days.
//
// Used by .github/workflows/screenshot-inventory.yml (weekly, and before the monthly check).
//   node scripts/scan-inventory.mjs              scan every lesson, then clean up
//   node scripts/scan-inventory.mjs mark-stuck-failed
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_TRIGGER (schedule | manual), SYNC_LOG_PATH (GitHub run link).
// The job fails (and GitHub emails you) when a batch fails twice, more than 10% of lesson pages could not be
// read, or the scan found far fewer screenshots than before (the lesson site served empty pages).

import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const FN = `${url}/functions/v1/scan-lesson-screenshots`;
const LIMIT = 50;
const MAX_PAGE_FAILURE_SHARE = 0.1;
const MIN_SHOT_SHARE = 0.6; // fewer than 60% of the previous screenshot count means the site served empty pages

const warn = (what, e) => console.log(`Health ${what} skipped: ${e?.message ?? e}`);

if (process.argv[2] === "mark-stuck-failed") {
  const { data, error } = await db.rpc("screenshot_scan_mark_stuck_failed");
  if (error) warn("run log", error);
  else console.log(`Marked ${data} stuck run(s) as failed`);
  process.exit(0);
}

async function call(body) {
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(FN, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      last = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    } catch (e) {
      last = e;
    }
    if (attempt === 1) {
      console.log(`Retrying in 30 s: ${last.message}`);
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
  throw last;
}

async function countScreenshots() {
  const { count, error } = await db.from("lesson_screenshots").select("lesson_id", { count: "exact", head: true });
  return error ? null : count;
}

let runId = null;
{
  const { data, error } = await db.rpc("screenshot_scan_log_start", {
    p_trigger: process.env.SYNC_TRIGGER ?? "manual",
    p_log_path: process.env.SYNC_LOG_PATH ?? null,
  });
  if (error) warn("run log", error);
  else runId = data;
}

const before = await countScreenshots();
const summary = { total_lessons: 0, pages_scanned: 0, screenshots: 0, page_failures: [], screenshots_before: before };
const problems = [];

try {
  for (let offset = 0; offset !== null; ) {
    const r = await call({ offset, limit: LIMIT });
    summary.total_lessons = r.total;
    summary.pages_scanned += r.pages_scanned;
    summary.screenshots += r.screenshots;
    summary.page_failures.push(...r.failures);
    console.log(`Batch ${offset}: ${r.pages_scanned} pages, ${r.screenshots} screenshots, ${r.failures.length} failed`);
    offset = r.next_offset;
  }

  if (summary.page_failures.length > summary.total_lessons * MAX_PAGE_FAILURE_SHARE) {
    problems.push(`${summary.page_failures.length} of ${summary.total_lessons} lesson pages could not be read`);
  }
  if (before && summary.screenshots < before * MIN_SHOT_SHARE) {
    problems.push(`Only ${summary.screenshots} screenshots found (${before} before): the lesson site may have served empty pages. Run it again later.`);
  }
  if (!problems.length) {
    const c = await call({ cleanup: true });
    summary.removed_lessons = c.removed_lessons;
    summary.removed_screenshots = c.removed_screenshots;
  } else {
    console.log("Cleanup skipped because of the problems below.");
  }
} catch (e) {
  problems.push(e.message);
}
summary.screenshots_after = await countScreenshots();

const status = problems.length ? "failed" : "success";
if (runId !== null) {
  const { error } = await db.rpc("screenshot_scan_log_finish", {
    p_id: runId,
    p_status: status,
    p_summary: summary,
    p_error: problems.join("; ") || null,
  });
  if (error) warn("run log", error);
}

const md = [
  `## Screenshot inventory: ${status}`,
  "",
  "| | |",
  "|---|---|",
  `| Lessons | ${summary.pages_scanned} of ${summary.total_lessons} scanned |`,
  `| Screenshots | ${summary.screenshots_after ?? summary.screenshots} (before: ${before ?? "unknown"}) |`,
  `| Removed (lesson gone) | ${summary.removed_lessons ?? "-"} lessons, ${summary.removed_screenshots ?? "-"} screenshots |`,
  `| Pages not read | ${summary.page_failures.length ? summary.page_failures.map((f) => `${f.key} (${f.error})`).join(", ") : "none"} |`,
  ...problems.map((p) => `| **Problem** | ${p} |`),
].join("\n") + "\n";
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(problems.length ? 1 : 0);
