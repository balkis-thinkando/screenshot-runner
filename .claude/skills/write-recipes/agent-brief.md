# Recipe agent brief (template)

Fill in the `<...>` parts before giving this to an agent: worktree path, batch number N, group name, and the group's table of images (file, lesson key and title, image position and section, full asset ID, lesson image path, what to capture).

## Goal
Write Playwright "recipes" that recapture lesson screenshots on the training site, so a monthly check can tell when the product UI drifted from the lesson image. Each recipe opens the screen shown in the lesson image, applies display-only tweaks (anonymize, outline), runs "checks" that encode what the lesson image shows, and captures 1280x800.

## Where
- Worktree: `<~/Downloads/screenshot-runner-bN>` (branch `recipes-batchN`, from main). node_modules is symlinked; `auth/state.json` is the test account's saved session. Write files only there.
- Read first: `lib/recipe.ts` (runRecipe, Checks, Blocked), `lib/tweaks.ts` (renameOrg, anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, spotlight, spotlightAreas, markers, hideMessages, fakeTable...), `lib/jira.ts` (openSignedIn, openJqlSearch), `lib/confluence.ts` (openConfluencePage, hideSidebar, openWhiteboard, ROVO_PAGE, ROVO_WHITEBOARD), `lib/rovo.ts`, `lib/studio.ts`, and any `lib/b*-*.ts` from earlier batches.
- Good examples to copy the style from: `recipes/AUC-385-5.spec.ts` (Jira, outline and markers, clip), `recipes/AUC-404-5.spec.ts` (Confluence editor, drag-select, Ask Rovo menu), `recipes/AUC-12977-2.spec.ts` (JQL search page), `recipes/AUC-13608-1.spec.ts` (outline areas), `recipes/AUC-14381-2.spec.ts` (whiteboard), `recipes/AUC-412-3.spec.ts` (Rovo answer in search).
- Lesson images (look at each one with Read before writing its recipe): `<scratchpad>/batchN/imgs/<AUC-key>-<pos>.png`
- Triage table: `batchN-triage.md` in the shared notes folder.

## Your group: <group name>
<table: file | lesson | image | asset ID | what the image shows / what to capture>

## Recipe file conventions
- File `recipes/AUC-<key>-<pos>.spec.ts`, `file: "AUC-<key>-<pos>"`, `title: "AUC-<key> #<pos> - <short screen name>"`, `product: "jira"`, `"confluence"` or `"admin"`, `assetId` = full asset ID from the table.
- Header comment like the existing recipes: Lesson (key, title, web URL), Image (#pos, section, what is outlined, image URL), Recipe line, then what the recipe does and any test data, stand-ins or fakes.
- Do NOT edit existing lib/ files (other agents work in parallel). Put helpers in the recipe file, or in a NEW lib file named after your group (`lib/bN-<group>.ts`).
- Checks: one per visible feature in the lesson image that matters to the steps (titles, buttons, menu items, columns...). Detail strings must never contain an email address or a real person's name. When a check fails, its detail says what is there instead.
- mask: anything that changes run to run (AI text, timestamps, counts, recent items, search results that depend on history).
- Tweaks: `renameOrg(page, s.test_org, s.display_org_name)`; `fakeSignedInUser(page, FAKE_PEOPLE[n])`; `fakeProfileNames(page)`; `anonymize(page, "<initials>", FAKE_PEOPLE)`. Outline what the lesson outlines (spotlight / spotlightAreas / markers). Park the mouse (`page.mouse.move(1279, 799)`) unless a hover is part of the shot.

## Hard rules
- Read-only on the Atlassian site: navigate, open menus/dialogs/editors, type into search boxes, select text. NEVER click Save, Publish, Update, Create, Delete, Move, Submit, Add, Connect, or anything that changes content. Opening the Confluence editor is OK only if you then leave without publishing (do not type into the page body). Sending a Rovo search question or prompt is OK (owner approved).
- Never print or write real people's names, emails or account IDs (filter "@" out of any UI text dump). Call people "a user".
- If a screen needs data that does not exist on the site, do not create it: make the recipe reach the closest real screen and report it as "needs test data", or use a display-only fake when it is just text or numbers.
- No em dashes in comments or report text.

## Test command (dry run, never records to Supabase)
```
cd <worktree> && RECORD_RUNS=false VERDICTS_FILE=results/<group>.jsonl TEST_SITE=https://learning-vkpy.atlassian.net TEST_ORG=learning-vkpy DISPLAY_ORG_NAME=Apex ./node_modules/.bin/playwright test recipes/<file>.spec.ts --retries=0 --workers=1 --ignore-snapshots --output test-results-<group>
```
Then read your verdicts file (each line: file, verdict, failedStep, checks with result/detail) and look at the capture PNG under `test-results-<group>/`. "Capture differs from the reference image" is expected (no baseline yet). Typecheck: `./node_modules/.bin/tsc --noEmit -p .`
For probing the site you may write throwaway scripts under `probe/` (git-ignored) using chromium with storageState `auth/state.json`; open pages via `https://id.atlassian.com/login?continue=<url>`. Delete probes and any screenshots with real names when done. Do not leave shells or test runs running when you finish.

## Done means
Every recipe in your group: typechecks, reaches its screen in a dry run (no failedStep), its capture shows the right screen with no real names or emails, and its checks pass except where the UI really differs from the lesson (then the detail says how). Report a table: file | reaches screen | checks failed (and why: UI change, or test data missing) | notes. Keep it short.
