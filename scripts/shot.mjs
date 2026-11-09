// Sends a capture to the create-shot-ticket Edge Function (creates the SHOT work item, sets Learning
// Content, attaches the image). Shared by create-shot-ticket.mjs (by hand) and ai-review.mjs (in CI).
// Auth: SUPABASE_SERVICE_ROLE_KEY, or SHOT_TOKEN (from select public.mint_shot_ticket_token()) with
// SUPABASE_ANON_KEY. SUPABASE_URL is required.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

/**
 * @param {{ assetId: string, verdict: string, changes: string[] | string, png?: string, issue?: string,
 *           aiReviewed?: boolean, dryRun?: boolean }} t
 * @returns {Promise<{ ok: boolean, body: any }>}
 */
export async function sendToShot(t) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SHOT_TOKEN } = process.env;
  if (!SUPABASE_URL) throw new Error("Set SUPABASE_URL");
  const headers = SUPABASE_SERVICE_ROLE_KEY
    ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    : SHOT_TOKEN && SUPABASE_ANON_KEY
      ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "x-shot-token": SHOT_TOKEN }
      : null;
  if (!headers) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY, or SHOT_TOKEN and SUPABASE_ANON_KEY");

  const form = new FormData();
  form.append("asset_id", t.assetId);
  form.append("verdict", t.verdict);
  form.append("changes", Array.isArray(t.changes) ? t.changes.join("\n") : t.changes);
  if (t.issue) form.append("issue_key", t.issue);
  if (t.aiReviewed) form.append("ai_reviewed", "true");
  if (t.dryRun) form.append("dry_run", "true");
  if (t.png) form.append("screenshot", new Blob([readFileSync(t.png)], { type: "image/png" }), basename(t.png));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-shot-ticket`, { method: "POST", headers, body: form });
  return { ok: res.ok, body: await res.json() };
}
