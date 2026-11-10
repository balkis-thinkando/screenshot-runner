// AI review of flagged screenshots (runs after the Playwright step in CI).
// For each needs_review screenshot that has a capture, Claude compares the published lesson image with
// today's capture and returns a verdict and the list of visible changes. The run in public.recipe_runs is
// updated; material and steps_broken verdicts create a SHOT work item with the capture attached (one open
// ticket per screenshot; the Edge Function skips duplicates). Captures stay on the runner.
//
// Env: ANTHROPIC_API_KEY (skips the review when missing), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      MAX_REVIEWS (default 25, cost guard), AI_REVIEW_DRY_RUN=true (no Supabase updates, no tickets).

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sendToShot } from "./shot.mjs";

export const MODEL = "claude-opus-5-5";
const maxReviews = Number(process.env.MAX_REVIEWS ?? 25);
const dryRun = process.env.AI_REVIEW_DRY_RUN === "true";

export const summary = (md) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

// Created on first use, so scripts/ai-repair.mjs can import review() without side effects
let _db, _client;
export const db = () => (_db ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }));
const client = () => (_client ??= new Anthropic());

const SYSTEM = `You review screenshots in Atlassian University lessons for a content maintenance team.
You get the screenshot currently published in a lesson and a new capture of the same screen, taken today on a
test site by following the lesson's recipe and applying the same annotations. Decide whether the lesson needs a
new screenshot, and list what changed.

Ignore: the stylised browser frame around the lesson image; organization, site and people names; avatars;
dates, counts, chart values and other data; anything in areas dimmed by the annotation overlay that the lesson
does not rely on; the exact length or position of annotation lines; small differences in scroll position, font
rendering or spacing; and anything listed under "Allowed differences".

Verdicts:
- unchanged: no meaningful difference.
- cosmetic: something differs, but a learner following the lesson would not be confused (colours, icons,
  spacing, badges such as "New", wording in background areas the lesson does not mention).
- material: something the lesson shows or relies on has changed (labels, menu items added, removed, renamed or
  moved, options, layout of the highlighted area). A new screenshot is needed.
- steps_broken: as material, and the lesson's own text or interactive graphic (hotspots, list text) also needs
  updating, or the steps no longer lead to this screen.

Changes: one short plain-text bullet per visible change in the product UI, for example "New sidebar item
Connectors, after Apps." or "Billing is renamed Billing and subscriptions." Cover every visible UI change, not
only failed checks. Only list changes: never mention what stayed the same, the annotations (outline, markers,
arrows, dimming), the anonymization (organization name, avatars) or anything else under "Ignore". Mark anything
you cannot confirm from the images with "(not confirmed)". For steps_broken, end with one bullet starting
"Lesson content to update:" that names only content in this image's own lesson section (marked in the lesson
text); content in other sections belongs to other screenshots. Never name real people. Do not use em dashes.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["unchanged", "cosmetic", "material", "steps_broken"] },
    summary: { type: "string", description: "One or two sentences for the run log." },
    changes: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "summary", "changes"],
  additionalProperties: false,
};

export async function lessonContext(assetId) {
  const { data: recipe, error } = await db()
    .from("screenshot_recipes")
    .select("lesson_id, image_url, must_show, ignore, notes, capture")
    .eq("asset_id", assetId)
    .single();
  if (error || !recipe) throw new Error(`No screenshot_recipes row for asset ${assetId}`);
  const [{ data: sections }, { data: shot }] = await Promise.all([
    db().from("sections").select("title, body").eq("lesson_id", recipe.lesson_id),
    db().from("lesson_screenshots").select("section, alt").eq("lesson_id", recipe.lesson_id).eq("asset_id", assetId).maybeSingle(),
  ]);
  // Mark this image's section so the review ties lesson-text updates to the right screenshot
  // (the image's heading is either a section title or a sub-heading inside a section's text)
  const heading = shot?.section?.trim().toLowerCase();
  const own = (s) => heading && (s.title.trim().toLowerCase() === heading || s.body.toLowerCase().includes(heading));
  const lessonText = (sections ?? [])
    .map((s) => `## ${s.title}${own(s) ? `  <-- THIS IMAGE'S SECTION (image under the heading "${shot.section}")` : ""}\n${s.body}`)
    .join("\n\n")
    .slice(0, 12_000);
  return { recipe, shot, lessonText };
}

/**
 * Compares the lesson image with row.capturePath. extra: more context lines (ai-repair.mjs uses it to say
 * that the path to the screen changed).
 */
export async function review(row, extra = []) {
  const { recipe, shot, lessonText } = await lessonContext(row.assetId);
  const lessonImg = await fetch(recipe.image_url);
  if (!lessonImg.ok) throw new Error(`Could not download the lesson image (${lessonImg.status})`);
  const lessonB64 = Buffer.from(await lessonImg.arrayBuffer()).toString("base64");
  const captureB64 = readFileSync(row.capturePath).toString("base64");

  const context = [
    `Screenshot: ${row.title}`,
    `Lesson section: ${shot?.section ?? "unknown"}`,
    `Alt text: ${shot?.alt ?? "none"}`,
    `What the capture shows: ${recipe.capture ?? ""}`,
    `Must show: ${JSON.stringify(recipe.must_show ?? [])}`,
    `Allowed differences: ${recipe.ignore ?? "none"}`,
    `Recipe notes: ${recipe.notes ?? "none"}`,
    `Scripted check results: ${JSON.stringify(row.checks ?? [])}`,
    "",
    ...extra,
    "",
    "Lesson text (for deciding steps_broken):",
    lessonText,
  ].join("\n");

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Published lesson image:" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: lessonB64 } },
          { type: "text", text: "New capture (today's UI):" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: captureB64 } },
          { type: "text", text: context },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error(`Review declined (${response.stop_details?.category ?? "no category"})`);
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`No answer (stop reason ${response.stop_reason})`);
  return { ...JSON.parse(text), lessonImage: recipe.image_url };
}

export const cell = (t) => String(t ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").slice(0, 300);

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY is not set: skipping the AI review.");
    summary("\n_AI review skipped: the ANTHROPIC_API_KEY secret is not set._\n");
    return;
  }

  const file = "results/verdicts.jsonl";
  const flagged = (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [])
    .filter((r) => r.verdict === "needs_review" && r.capturePath && existsSync(r.capturePath));
  if (!flagged.length) {
    console.log("Nothing to review.");
    return;
  }
  if (flagged.length > maxReviews) console.log(`${flagged.length} flagged; reviewing the first ${maxReviews} (MAX_REVIEWS).`);

  const lines = ["\n## AI review", "", "| Screenshot | AI verdict | Ticket | Summary |", "|---|---|---|---|"];
  let failures = 0;

  for (const row of flagged.slice(0, maxReviews)) {
    let verdict = "needs_review";
    let ticket = "";
    let note = "";
    try {
      const result = await review(row);
      verdict = result.verdict;
      note = result.summary;
      console.log(`${row.title}: ${verdict}\n  ${result.changes.join("\n  ")}`);

      if (!dryRun && row.runId) {
        const { error } = await db().from("recipe_runs").update({ verdict, summary: `AI review: ${note}` }).eq("id", row.runId);
        if (error) throw error;
      }
      if (["material", "steps_broken"].includes(verdict)) {
        if (dryRun) {
          ticket = "(dry run)";
        } else {
          const { ok, body } = await sendToShot({ assetId: row.assetId, verdict, changes: result.changes, png: row.capturePath, lessonImage: result.lessonImage, aiReviewed: true });
          if (!ok) throw new Error(`Ticket not created: ${body.error ?? JSON.stringify(body)}`);
          ticket = body.status === "duplicate" ? `${body.key} (already open)` : body.key;
        }
      }
    } catch (e) {
      failures++;
      note = e instanceof Anthropic.APIError ? `Claude API error ${e.status}: ${e.message}` : `Review failed: ${e.message}`;
      console.error(`${row.title}: ${note}`);
    }
    lines.push(`| ${cell(row.title)} | ${verdict} | ${cell(ticket)} | ${cell(note)} |`);
  }

  const md = lines.join("\n") + "\n";
  console.log(md);
  summary(md);
  if (failures) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
