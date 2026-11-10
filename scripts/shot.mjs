// Sends a capture to the create-shot-ticket Edge Function (creates the SHOT work item, sets Learning
// Content, attaches the image). Shared by create-shot-ticket.mjs (by hand) and ai-review.mjs (in CI).
// Auth: SUPABASE_SERVICE_ROLE_KEY, or SHOT_TOKEN (from select public.mint_shot_ticket_token()) with
// SUPABASE_ANON_KEY. SUPABASE_URL is required.

import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { sideBySide } from "./compare.mjs";
import { brand } from "./frame.mjs";

/**
 * @param {{ assetId: string, verdict: string, changes: string[] | string, png?: string, issue?: string,
 *           aiReviewed?: boolean, aiRepaired?: boolean, stepsChanged?: string, dryRun?: boolean, raw?: boolean,
 *           lessonImage?: string, attachOnly?: boolean }} t
 * The capture is framed like the lesson images before it is attached, unless raw is true. With lessonImage
 * (URL of the current lesson image), a side-by-side comparison is attached too. With issue and attachOnly,
 * the images are added to that ticket and its description is left alone. aiRepaired (label ai-repaired) and
 * stepsChanged (how the path to the screen changed) come from scripts/ai-repair.mjs.
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
  if (t.attachOnly) form.append("attach_only", "true");
  if (t.aiReviewed) form.append("ai_reviewed", "true");
  if (t.aiRepaired) form.append("ai_repaired", "true");
  if (t.stepsChanged) form.append("steps_changed", t.stepsChanged);
  if (t.dryRun) form.append("dry_run", "true");

  // Framed copy and comparison in the temp folder, removed once sent
  const stem = join(tmpdir(), `shot-${process.pid}-${basename(t.png ?? "capture.png", ".png")}`);
  const framed = t.png && !t.raw ? `${stem}-framed.png` : null;
  const comparison = t.png && t.lessonImage ? `${stem}-comparison.png` : null;
  try {
    if (framed) await brand(t.png, framed);
    if (comparison) await sideBySide(t.lessonImage, framed ?? t.png, comparison);
    if (t.png) form.append("screenshot", new Blob([readFileSync(framed ?? t.png)], { type: "image/png" }), basename(t.png));
    if (comparison) form.append("comparison", new Blob([readFileSync(comparison)], { type: "image/png" }), "comparison.png");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-shot-ticket`, { method: "POST", headers, body: form });
    return { ok: res.ok, body: await res.json() };
  } finally {
    for (const f of [framed, comparison]) if (f) rmSync(f, { force: true });
  }
}
