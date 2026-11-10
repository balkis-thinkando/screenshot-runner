# Screenshot runner

Read `HANDOVER.md` first, starting with section 0 (current status, owner decisions, next task). It has the full context.

Rules for this repo:
- Supabase project ref `pduavmiyphkoekslpeld`. Never modify pre-existing tables (`lessons`, `sections`, `ilt_*`).
- `lesson_screenshots` is rebuilt on every scan — never reference its rows by FK.
- Read the test site, org and display name from `public.recipe_settings`; never hard-code them.
- Page tweaks are display-only DOM edits. Never change real Atlassian settings to stage a screenshot.
- Routine runs must not call AI. AI is only for drafting recipes/specs, reviewing `needs_review` runs, and repairing scripts.
- `blocked` runs never create Jira tickets.
- Secrets (Supabase service key, Atlassian token, auth/state.json) are never committed.
- Dry-run with `RECORD_RUNS=false` before writing to Supabase.
- Never print real people's names, emails or account IDs (including the test account's); use "user A/B".
- Answers to the owner: concise, with tables, no em dashes.
- Pushing to `main` on GitHub is fine for finished, tested work; ask before anything destructive.
- Changes to `supabase/functions/` must be redeployed to Supabase (deploy_edge_function) to take effect.
- Any change on the Atlassian test site (creating or editing data, settings) needs the owner's OK first.
