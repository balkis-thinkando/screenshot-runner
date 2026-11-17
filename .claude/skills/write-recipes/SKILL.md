---
name: write-recipes
description: Pick a batch of lessons, triage their images, write Playwright screenshot recipes for the capturable ones, dry-run them, and register them in Supabase. Use when the owner asks to "pick up another batch", "write recipes for lesson AUC-xxx", or "add screenshots to the monthly check".
---

# Write a batch of screenshot recipes

A recipe recreates one lesson screenshot on the test site so the monthly check can tell when the product UI drifted from the lesson image. This skill is the end-to-end process used for the Rovo batch and batch 2 (Nov 2026). Follow the phases in order and stop at each **OWNER OK** gate.

Read `CLAUDE.md` (repo rules) and `HANDOVER.md` section 0 first. The rules there always win.

## Inputs

The owner says one of:
- "Pick another batch of N lessons" (default N = 20): choose lessons yourself (phase 1).
- "Write recipes for AUC-123, AUC-456": use those lesson keys.
- "Write recipes for the Rovo lessons" (or another title word): filter by title.

## Phase 1: pick the lessons

Supabase project `pduavmiyphkoekslpeld`. Lessons with screenshots and no recipe yet:

```sql
select a.alcat_key, l.title, count(*) images
from lesson_screenshots ls
join lessons l on l.id = ls.lesson_id
join alcat_lessons a on a.lesson_id = ls.lesson_id
where not exists (select 1 from screenshot_recipes r where r.asset_id = ls.asset_id)
group by 1, 2
order by 1
limit 20;
```

Add `and l.title ilike '%rovo%'` (or `a.alcat_key in (...)`) to narrow it. Prefer lessons about products the test site has (Jira, JSM, Confluence, Rovo, Admin).

Then list every image of the chosen lessons:

```sql
select a.alcat_key, ls.position, ls.section, ls.asset_id, ls.file_type, ls.image_url, ls.lesson_id
from lesson_screenshots ls join alcat_lessons a on a.lesson_id = ls.lesson_id
where a.alcat_key in (...) order by 1, 2;
```

## Phase 2: triage the images

1. Download every image to the scratchpad (`<scratchpad>/batchN/imgs/<AUC-key>-<pos>.<ext>`). Convert SVG, WEBP and GIF to PNG (`sips -s format png`, first frame for GIFs) so they can be viewed.
2. Look at **every** image with Read. Classify each:

| Class | Meaning |
|---|---|
| capture | A real product screen the test site can show as is |
| capture* | Capturable but needs an action (type a query, open an editor, wait for AI) |
| blocked | Real UI, but needs data or setup the site lacks (live chat, Bitbucket, attachments) |
| N/A | Illustration, photo, diagram, marketing graphic, external docs site |
| duplicate | Same asset already listed |

3. Write the triage table to the shared notes folder (`batchN-triage.md`): `# | lesson | pos | asset (8 chars) | class | what it shows (max 15 words)`, plus a count per class.
4. **OWNER OK**: show the counts and the capture/capture* list, and ask "write the N?". Do not write recipes before the owner agrees.

## Phase 3: write the recipes

Work in a worktree so `main` stays clean:

```bash
cd ~/Downloads/screenshot-runner && git fetch -q && git worktree add -b recipes-batchN ../screenshot-runner-bN origin/main
ln -s ../screenshot-runner/node_modules ../screenshot-runner-bN/node_modules
mkdir -p ../screenshot-runner-bN/auth && cp auth/state.json ../screenshot-runner-bN/auth/
```

For more than about 8 recipes, split them by product area (for example Jira/JSM, Confluence editor, search and whiteboards) and give each group to a background agent with `agent-brief.md` (in this skill folder) as its brief, filled in with the worktree path, the group's image list and asset IDs. Each group uses its own `VERDICTS_FILE` and `--output` folder so parallel runs do not clash. For a handful, write them yourself following the same brief.

Recipe essentials (details in `agent-brief.md`):
- File `recipes/AUC-<key>-<pos>.spec.ts`, using `runRecipe` from `lib/recipe.ts`.
- `product` must be a schedule tag: `admin`, `confluence` or `jira` (JSM and Rovo-in-Jira use `jira`; Rovo-in-Confluence and Studio use `confluence`, check `schedule.json`).
- Reuse helpers in `lib/` (`openSignedIn`, `openConfluencePage`, `openWhiteboard`, `openAgentInStudio`, `spotlight`, `spotlightAreas`, `markers`, `fakeSignedInUser`, `fakeProfileNames`, `anonymize`, `renameOrg`). New helpers go in a new `lib/bN-<group>.ts` file; do not edit shared lib files while agents run in parallel.
- One check per feature in the lesson image that matters to the lesson steps. Check details never contain emails or real names.
- Mask everything that changes run to run (AI text, timestamps, recent items, results).
- Read-only on the site. Opening an editor is fine if nothing is typed into the body and nothing is published. Sending a Rovo search or prompt is OK. Creating any test data needs an **OWNER OK** per item.

## Phase 4: verify

When all groups are done:
1. `./node_modules/.bin/tsc --noEmit -p .` in the worktree: must be clean.
2. Every recipe reaches its screen in a dry run (no `failedStep` in the verdicts file):
   `RECORD_RUNS=false VERDICTS_FILE=results/bN.jsonl TEST_SITE=https://learning-vkpy.atlassian.net TEST_ORG=learning-vkpy DISPLAY_ORG_NAME=Apex ./node_modules/.bin/playwright test recipes/<files> --retries=0 --workers=1 --ignore-snapshots --output test-results-bN`
3. Privacy: `grep -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}'` over the new recipes, lib files and verdicts files must find nothing. Open each capture PNG and check every visible person is a fake name from `FAKE_PEOPLE` in `lib/tweaks.ts`.
4. Classify each failed check: **UI change** (the product changed: this is what the monthly check is for), **test data** (the site lacks something), or **site settings**.
5. Report to the owner: one table `recipe | failed checks | why`, then the stand-ins and test-data gaps.

## Phase 5: commit, PR, Supabase rows (OWNER OK)

Ask once: "Commit, push, open a PR and insert the N draft rows?" Then:

1. Commit only the new recipes and `lib/bN-*.ts` (never `auth/`, `results/`, `test-results*`, baselines). Commit message ends with the Co-Authored-By line. Push the branch.
2. PR: there is no `gh` CLI on this Mac. Give the owner the link `https://github.com/balkis-thinkando/screenshot-runner/pull/new/recipes-batchN` and a short description to paste.
3. Draft rows in `screenshot_recipes`, one per recipe. Take `lesson_id`, `image_url` and `asset_id` from `lesson_screenshots` (join on `asset_id` and the lesson's `lesson_id`; an asset can appear in two lessons). Fill `image_kind='ui_screenshot'`, `product` (display name: Jira, Confluence, Jira Service Management, Rovo Studio...), `required_role`, `preconditions='Signed in to {test_site} as the test account.'`, `start_url` with `{test_site}`, `steps` (jsonb array from the recipe header), `capture`, `must_show` (the check names), `page_tweaks`, `notes` (test-data gaps, UI changes, stand-ins), `script_path='recipes/<file>.spec.ts'`, `status='draft'`.
4. Dry run first: wrap the insert in `do $$ declare n int; begin with ins as (insert ... returning 1) select count(*) into n from ins; raise exception 'DRYRUN rows=%', n; end $$;` (the exception rolls it back). Only then run the real insert.
5. Append a dated line to the progress log in the notes folder and update `HANDOVER.md` section 0.

## Phase 6: tell the owner what to run

After the PR is merged, the owner runs **Actions > Monthly check > Run workflow** on `main`:

| Run | product | update_baselines |
|---|---|---|
| 1. Check (creates SHOT tickets for real changes) | `x|AUC-(123|456|789)\b` with this batch's lesson keys | off |
| 2. After reviewing the tickets, save baselines | same value | on |

Give the exact `product` string in a code block on its own line: owners copy it as is. The leading `x|` is needed because the workflow prefixes `@`.

## Lessons learned

- Jira pages must be opened through `openSignedIn` (`id.atlassian.com/login?continue=`), or they render signed out.
- Whiteboards render in an iframe: use `frameLocator('iframe[src*="/whiteboards/whiteboard/"]')`; element boxes from inside the frame are offset by the iframe position.
- `fakeProfileNames()` can rename field labels on the Jira work item view ("Start date", "Category"); see `fakeFieldPeople()` in `lib/b2-jira.ts`.
- Rovo answers vary: mask the text, check the frame (headings, buttons, footer).
- The test account sees the old Studio layout; Studio helpers are in `lib/studio.ts`.
- If a lesson object does not exist on the site (a named whiteboard, page or space), use the closest real one as a stand-in and say so in the header comment and the row's `notes`.
- Background agents can leave shells running; check `pgrep -fl playwright` before your own test run.
