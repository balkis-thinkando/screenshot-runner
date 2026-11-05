# Screenshot runner

Replays lesson screenshot recipes against the Atlassian test site with Playwright, checks the
result, and records each run in Supabase (`public.recipe_runs`). AI is only needed afterwards,
for runs marked `needs_review`.

## Layout

```
lib/recipe.ts      shared runner: navigate → tweak → check → capture → compare → record
lib/tweaks.ts      page tweaks: renameOrg (Apex), anonymize, hideMessages
lib/supabase.ts    Supabase client + recipe_settings (test_site, test_org, display_org_name)
recipes/*.spec.ts  one small file per screenshot: navigation, checks, masked areas
baselines/*.png    last approved capture of each screenshot (created on first run)
```

The recipe in `public.screenshot_recipes` is the human-readable spec. The file in `recipes/`
is its executable version; `screenshot_recipes.script_path` points to it.

## Verdicts

| Verdict | Meaning | Next |
|---|---|---|
| `unchanged` | All checks pass and the capture matches the baseline | Nothing. No AI call. |
| `needs_review` | A check failed, the capture differs, or a step failed | AI compares the capture with the lesson image → cosmetic / material / steps broken |
| `blocked` | Session expired, org not found, missing test data | Fix the environment or the recipe. No ticket. |

## Setup

1. `npm ci && npx playwright install chromium`
2. Sign in once as the test account and save the session (no password is stored):
   `npm run login` → sign in, open the test organization, close the window.
   This writes `auth/state.json`. In CI, store it as a secret and write it to that path before running.
   Sessions expire; when they do, runs come back `blocked` with "Session expired".
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (secrets, never committed).
4. First run creates the baselines: `npm run update-baselines`. Review the images in `baselines/`
   and commit them.

## Run

```
npm test                         # all recipes
npx playwright test AUC-330      # one lesson
RECORD_RUNS=false npm test       # dry run, nothing written to Supabase
```

After a screenshot is replaced in Contentful, update its baseline:
`npx playwright test AUC-330-2 --update-snapshots`.
