// Sends a capture to the create-shot-ticket Edge Function, which creates the SHOT work item,
// sets Learning Content and attaches the image. The capture is not stored anywhere else.
//
// node scripts/create-shot-ticket.mjs --asset <asset_id> --png <capture.png> --verdict material|steps_broken
//      --changes <changes.txt> [--dry-run]
// Rewrite an existing ticket's description instead (no new ticket, --png optional): add --issue SHOT-123
//
// Auth: SUPABASE_SERVICE_ROLE_KEY, or SHOT_TOKEN (from select public.mint_shot_ticket_token())
// with SUPABASE_ANON_KEY. SUPABASE_URL is required.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    asset: { type: "string" },
    png: { type: "string" },
    verdict: { type: "string" },
    changes: { type: "string" },
    issue: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
for (const k of ["asset", "verdict", "changes", ...(a.issue ? [] : ["png"])]) if (!a[k]) throw new Error(`--${k} is required`);

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SHOT_TOKEN } = process.env;
if (!SUPABASE_URL) throw new Error("Set SUPABASE_URL");
const headers = SUPABASE_SERVICE_ROLE_KEY
  ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  : SHOT_TOKEN && SUPABASE_ANON_KEY
    ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "x-shot-token": SHOT_TOKEN }
    : null;
if (!headers) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY, or SHOT_TOKEN and SUPABASE_ANON_KEY");

const form = new FormData();
form.append("asset_id", a.asset);
form.append("verdict", a.verdict);
form.append("changes", readFileSync(a.changes, "utf8"));
if (a.issue) form.append("issue_key", a.issue);
if (a["dry-run"]) form.append("dry_run", "true");
if (a.png) form.append("screenshot", new Blob([readFileSync(a.png)], { type: "image/png" }), basename(a.png));

const res = await fetch(`${SUPABASE_URL}/functions/v1/create-shot-ticket`, { method: "POST", headers, body: form });
const out = await res.json();
console.log(JSON.stringify(out, null, 2));
if (!res.ok) process.exit(1);
