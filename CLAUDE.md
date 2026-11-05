# Screenshot runner

Read `HANDOVER.md` first: it has the full context (systems, Supabase schema, decisions, next tasks).

Rules for this repo:
- Supabase project ref `pduavmiyphkoekslpeld`. Never modify pre-existing tables (`lessons`, `sections`, `ilt_*`).
- `lesson_screenshots` is rebuilt on every scan — never reference its rows by FK.
- Read the test site, org and display name from `public.recipe_settings`; never hard-code them.
- Page tweaks are display-only DOM edits. Never change real Atlassian settings to stage a screenshot.
- Routine runs must not call AI. AI is only for drafting recipes/specs, reviewing `needs_review` runs, and repairing scripts.
- `blocked` runs never create Jira tickets.
- Secrets (Supabase service key, Atlassian token, auth/state.json) are never committed.
- Dry-run with `RECORD_RUNS=false` before writing to Supabase.
