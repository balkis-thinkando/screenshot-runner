# Handover: Screenshot freshness monitoring for Atlassian University lessons

Owner: Balkis (balkis@thinkando.co.uk) · Handover date: 5 Nov 2026 · From: Claude (claude.ai session) → Claude Code

This document is the full context for continuing this project in Claude Code. Read it before changing
anything. Everything listed under "What exists" is live.

---

## 1. Goal

Keep screenshots in Atlassian University on-demand lessons up to date, with as little human and AI
effort as possible:

1. Know every screenshot in every lesson (inventory).
2. For each UI screenshot, store how to recreate it (a **recipe**).
3. Periodically replay recipes against a test Atlassian site with **Playwright**, apply display
   tweaks, capture, and check.
4. When the UI has materially changed, **create a Jira ticket**. A human updates the image in
   Contentful. Contentful is never written to automatically.

Design principle agreed with the owner: **Playwright does the routine work; AI only handles
exceptions** (drafting recipes/scripts once, judging captures that changed, repairing broken scripts).
An AI agent driving the browser on every run was rejected as too costly.

---

## 2. Systems and identifiers

| System | Detail |
|---|---|
| Atlassian site (AlCat, Jira, Confluence) | `https://atlassiantraining.atlassian.net` |
| AlCat = Atlassian Learning Catalog | Assets object schema **ID 7**, key **AUC** |
| Assets workspace ID | `5f82c31c-7c7d-440b-887a-530eb23c1930` |
| Lesson object type | **80** (Feature = 65) |
| Lesson attribute IDs | Key 544, Name 545, Updated 547, Status 550, Slug **696**, Contentful Identifier **699**, web_url 2248 (only 1 of 412 filled in — not used), Media Count 887 (not maintained — **do not use**) |
| Assets REST API | `https://api.atlassian.com/jsm/assets/workspace/{workspaceId}/v1/object/aql` (POST, Basic auth email:token, body `{"qlQuery":"objectTypeId = 80"}`) |
| Published lesson URL | `https://community.atlassian.com/learning/lesson/{slug}` |
| Lesson images | Hosted on Orange Logic: `https://dam-cdn.atl.orangelogic.com/public/{ID}.png` or `.../AssetLink/{id}[.ext]` (not Contentful) |
| Supabase project | "Atlassian Learning Content", ref **`pduavmiyphkoekslpeld`**, region eu-west-1 |
| Test environment | Site `https://learning-vkpy.atlassian.net`, organization **learning-vkpy** in admin.atlassian.com (the owner changes this periodically; read it from `recipe_settings`, never hard-code) |
| Jira maintenance project | **PEZ** (content maintenance). Existing work types include On Demand Update (has a "Learning Content" Assets picker) and Product Update (epic). |

Related Confluence pages (atlassiantraining.atlassian.net/wiki):
- AlCat overview: spaces/TA/pages/10804297752
- PEZ project and agent: spaces/maint01/pages/11635982519
- On Demand Update Work Item Specification: spaces/maint01/pages/11619237891
- Product Update Epic Specification: spaces/maint01/pages/11616649350
- SHIFT-7 AI Transformation for Content Maintenance: spaces/~632248a404903f8118c36993/pages/11499143195

---

## 3. What exists in Supabase

Pre-existing tables (owned by other work, e.g. LEARN-28 agent): `lessons` (id = **Contentful entry ID**,
title, url, embedding…), `sections` (lesson_id, title, body = lesson text), plus `ilt_*` tables for
instructor-led training. **Do not modify these.** Supabase is a searchable mirror; it is never the
source of truth for content.

### Tables created for this project (all RLS enabled, no policies → service role only)

**`alcat_lessons`** — one row per AlCat Lesson (412 rows)
`lesson_id text PK → lessons.id` (Contentful ID), `alcat_object_id bigint unique`, `alcat_key text` (e.g. AUC-330),
`slug`, `web_url` (built from slug), `image_count int` (images actually on the page), `scanned_at`.

**`lesson_screenshots`** — one row per image on a published lesson page (756 rows across 272 lessons)
PK `(lesson_id, position)`. `section` (nearest heading above), `asset_id` (Orange Logic ID, last URL segment
without extension), `file_type` (png 508, none 190, svg 49, gif 4, auto 3, webp 2), `image_url`, `alt`, `scanned_at`.
⚠ Rows are **deleted and re-inserted** for each lesson on every scan. Nothing may FK to this table.

**`screenshot_recipes`** — how to recreate a screenshot (2 rows so far, both lesson AUC-330)
`id uuid PK`, `lesson_id → lessons.id`, `image_url`, `asset_id`, unique `(lesson_id, image_url)`,
`image_kind` ∈ ui_screenshot | diagram | illustration | icon | other,
`product`, `required_role`, `preconditions`, `start_url`,
`steps jsonb` (ordered plain-English navigation), `page_tweaks jsonb` (in-page edits before capture),
`capture` (what/size to capture), `must_show jsonb` (checks), `ignore` (allowed differences),
`status` ∈ draft | reviewed | retired | not_applicable, `notes`, `drafted_by`, `reviewed_by`,
`script_path` (Playwright file in this repo), timestamps.
Text fields may contain placeholders `{test_site}`, `{test_org}`, `{display_org_name}`.

**`recipe_settings`** — key/value, edited by the owner in the Supabase Table Editor
`test_site = https://learning-vkpy.atlassian.net`, `test_org = learning-vkpy`, `display_org_name = Apex`.

**`recipe_runs`** — one row per replay
`recipe_id → screenshot_recipes.id (cascade)`, `run_at`, `test_site`, `verdict`, `check_results jsonb`
(`[{check, result, detail}]`), `summary`, `run_by`, `failed_step`, `baseline_match bool`,
`capture_path` (unused: captures are not stored).
Verdicts: `unchanged`, `needs_review`, `cosmetic`, `material`, `steps_broken`, `blocked`
(see section 5).

### Other Supabase objects
- No storage bucket. Captures are never stored in Supabase; they are attached to the SHOT work item only
  (bucket `recipe-captures` deleted 5 Nov 2026).
- **Edge Function `scan-lesson-screenshots`** (v4) — builds the inventory:
  reads all Lessons from Assets (secrets `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`), keeps those whose
  Contentful ID exists in `lessons`, fetches each published page, regex-scans `<main>` for `<img>` on
  dam-cdn/ctfassets and the preceding `<h1-4>`, upserts `alcat_lessons`, replaces `lesson_screenshots`.
  Body `{"offset":0,"limit":50}`; returns `next_offset` (null when done). Also `{"debug_url": "..."}`.
  `verify_jwt` is on; it is invoked with the project's anon key.
- **Extension `pg_net`** enabled (used to call the function from SQL).
- **SQL function `public._scan_batch(p_offset int)`** — calls the Edge Function for one batch via pg_net.
  Execute revoked from anon/authenticated. Contains the (public) anon key.
- Edge Function secrets present: `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`.

### Gotchas learned
- **Run scan batches one at a time.** Firing all 9 batches in parallel (~54 concurrent page fetches)
  made community.atlassian.com return pages without lesson content (59 images found instead of ~750).
  Sequential batches of 50 with concurrency 6 are reliable (~40 s each).
- A DOM parser (deno-dom) in the Edge Function hit `WORKER_RESOURCE_LIMIT`; the regex scanner replaced it.
- Supabase flags **RLS disabled on all 13 pre-existing tables** (lessons, sections, ilt_*). Anyone with the
  anon key can read/modify them. The owner has been told; do not enable RLS on them without agreeing
  policies with her (it would break whatever reads them, e.g. the LEARN-28 agent).

---

## 4. The Playwright runner (this repo)

```
lib/recipe.ts      runRecipe(): navigate → tweak → checks → capture → compare to baseline → record
lib/tweaks.ts      renameOrg(from,to), anonymize(), hideMessages([...startsWith])
lib/supabase.ts    service-role client + settings() from recipe_settings
recipes/*.spec.ts  one file per screenshot (navigation, checks, mask)
baselines/*.png    last approved capture per screenshot (local only, gitignored; never committed)
auth/state.json    saved signed-in session (gitignored; CI secret)
```

Status: **type-checks and lists, but has never been run against Atlassian** (the previous environment
could not reach Atlassian). First job is to run it for real (section 7, task 1).

Config: viewport **1321×853** (lesson image size), light mode, en-US, UTC, workers 3, retries 1.
Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `RECORD_RUNS=false` for dry runs.

Run flow and verdict logic (`lib/recipe.ts`):
- Navigation throws `Blocked` (session expired → redirected to id.atlassian.com, org not in list) → **blocked**.
- Any other navigation error → **needs_review** with `failed_step`.
- Else tweaks, checks (each recorded pass/fail with detail; never stops early), screenshot, then
  `toHaveScreenshot` against `baselines/{file}.png` with `mask` and `maxDiffPixelRatio 0.002`.
- All checks pass **and** baseline matches → **unchanged** (no AI). Otherwise **needs_review**.
- Records a `recipe_runs` row (`run_by = playwright`) The capture stays in `test-results/` for the SHOT work item.

Selectors confirmed on the live admin page (5 Nov 2026): sidebar `[data-testid="side-nav-view"]`
(nav aria-label "Sidebar"), org switcher `[data-testid="org-selector-dropdown--trigger"]`, charts under
`[data-testid*="chart"]` (masked), page has **no `<main>`**, card titles are `h2`
(text includes the action link, e.g. "Open requests for app accessReview requests"), profile picture
`img[src*="/avatar"]`.

Page tweaks are **display-only DOM edits**. Never change real account or org settings to stage a screenshot.

---

## 5. Verdicts and what happens next

| Verdict | Set by | Meaning | Action |
|---|---|---|---|
| unchanged | Playwright | checks pass + matches baseline | none |
| needs_review | Playwright | check failed / capture differs / step failed | AI review (not built yet) |
| cosmetic | AI review | differs, still accurate | none; optionally refresh baseline |
| material | AI review | labels, layout, options changed | Jira ticket |
| steps_broken | AI review | lesson steps no longer work in product | Jira ticket (+ lesson text) |
| blocked | Playwright | login/permissions/test data problem | fix environment; **never** a ticket |

AI review (to build): input = lesson image (`image_url`), new capture (local file from the run), recipe
`must_show` + `ignore` + `check_results`. Output = verdict + summary, written back to the run.
One vision call per needs_review run. If a script failed because selectors moved but the page is
still correct, the AI should propose a script fix, not a ticket.

---

## 6. The one completed proof of concept

Lesson **AUC-330** "How do you administer an Atlassian organization?"
https://community.atlassian.com/learning/lesson/how-do-you-administer-an-atlassian-organization

- Image 1 (`2wk23ea2uc1438fum0rx10wdmd15mgs4`) is a **diagram** of the fictional Woozlemania org →
  recipe `image_kind=diagram`, `status=not_applicable`; must_show holds facts to verify against docs.
- Image 2 (`5bph3ptlw74w0622n11j2040iotd1ao5`, section "What is Atlassian Administration?") →
  recipe `draft`, script `recipes/AUC-330-2.spec.ts`.
- Replayed manually on 4 Nov 2026 in a browser (not Playwright) → `recipe_runs` verdict **material**:
  sidebar now has Connectors, AI and Rovo, Usage (New); Billing renamed "Billing and subscriptions";
  Monitor cards now Rovo credits usage / Open requests for app access / Active users;
  "Users with access to your apps" removed; Invite users gone from the top bar. 4/7 checks passed.
  Image 3 in the same lesson (sidebar tabs) and the "Administer an organization" text are very likely
  outdated too.
- No Jira ticket created yet.

Expected result when the Playwright script runs today: checks 1, 3 and 6 fail (same as above).

---

## 7. Next tasks (in order)

1. **Run the runner for real.** `npm ci`, `npx playwright install chromium`, `npm run login` (owner signs
   in as the test account; saves `auth/state.json`), set env vars, `RECORD_RUNS=false npx playwright test`
   first. Fix selectors if needed. Confirm checks 1, 3, 6 fail as in section 6. Then
   `npm run update-baselines` and commit the baseline.
   ⚠ A baseline of today's UI is what future runs compare against — it is *not* the lesson image.
2. **Put this in GitHub** and add a scheduled workflow (weekly, plus `workflow_dispatch`). Secrets:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_STATE_JSON` (written to `auth/state.json`).
   Prefer a dedicated test Atlassian account without SSO/MFA on the test org; sessions expire →
   runs return `blocked`, which should alert the owner rather than fail silently.
3. **Classify all 756 images** → `image_kind` (ui_screenshot / diagram / illustration / icon / other).
   SVG/GIF are almost certainly not UI screenshots. Use a vision model on image + alt + section.
   Store results in `screenshot_recipes` (create rows with `status=not_applicable` for non-UI) or a new
   column on a stable table — remember `lesson_screenshots` is rebuilt every scan.
4. **Draft recipes in bulk** for UI screenshots, one product at a time (pilot: ~40–50 screenshots in one
   product). Sources: image, alt, `sections.body` for the lesson, section heading. Status `draft`; owner reviews.
   Aggregate `preconditions` into a **test-site setup checklist** — test data is expected to be the hardest part.
5. **Generate a Playwright spec per reviewed recipe** following `AUC-330-2.spec.ts`; set `script_path`.
6. **Build the AI review step** for `needs_review` runs (section 5).
7. **Jira tickets** for material / steps_broken. Owner has not decided: new type in **PEZ** (recommended,
   reuses Learning Content Assets field) vs a new space (suggested name "Screenshot Maintenance", key SHOT).
   Proposed fields: Learning Content (Assets), Product (Assets), Lesson URL, Section, Screenshot asset ID,
   Current image URL, New capture (attachment), Verdict, Failed checks, Recipe ID / Run ID,
   "Also update lesson text". Workflow: Detected → Triaged → In progress → In review → Published,
   plus False positive / Won't fix. Dedupe: no new ticket if one is open for the same asset ID.
   On Published: rerun recipe and refresh baseline. On False positive: set recipe back to draft.
8. **Scheduling policy:** run recipes for lessons linked (via AlCat Features) to new PEZ Product Update
   epics, plus a monthly full sweep. Re-scan the inventory (Edge Function) before each sweep.
9. Later: PowerPoint (ILT) screenshots — not covered yet (`ilt_slides` exists in Supabase).

---

## 8. Owner preferences and decisions

- Wants concise answers with a clear recommendation.
- Cost matters: Playwright for routine runs, AI only for exceptions.
- Recipes = data in Supabase; scripts = code in this repo (not stored per row in the DB).
- Test site and display name are variables she changes periodically → always read `recipe_settings`.
- Captures are anonymized and the org is shown as **Apex**.
- Humans update Contentful; automation stops at the Jira ticket.
- Never handle her credentials directly; secrets live in Supabase/CI secret stores.
