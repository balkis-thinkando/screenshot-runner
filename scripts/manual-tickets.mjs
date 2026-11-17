// Manual-capture tickets (runs after the AI review and AI repair in CI).
// When the runner could not produce a screenshot, a SHOT work item asks for it to be captured by hand, with
// the lesson link, why it failed and the recipe's steps (start URL, steps, what the capture must show).
// A screenshot counts as "not captured" when:
//   - its script did not reach the screen and scripts/ai-repair.mjs could not repair it (or skipped it);
//   - it was blocked for a reason other than an expired sign-in (e.g. missing test data or permissions);
//   - its test crashed or timed out before writing a result (found in Playwright's results/report.json).
// An expired sign-in blocks every screenshot at once, so it is not ticketed: refresh AUTH_STATE_JSON instead.
// No image is attached: the page snapshot taken when a script stops is only partly anonymized (avatars and
// email addresses), so names on the page could show. One open ticket per screenshot (the Edge Function
// returns "duplicate" when one exists).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_REVIEW_DRY_RUN=true (shows what would be ticketed,
//      creates nothing), MANUAL_TICKETS=false (skip).

import { existsSync, readFileSync } from "node:fs";
import { cell, db, summary } from "./ai-review.mjs";
import { sendToShot } from "./shot.mjs";

const dryRun = process.env.AI_REVIEW_DRY_RUN === "true";
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const signIn = /session expired|sign-in|signed out/i;

/** "AUC-13461 #1 - Create request types" -> "AUC-13461-1" */
const fileOf = (title) => title.match(/^(AUC-\d+) #(\d+)/)?.slice(1).join("-") ?? null;

function crashedTests(rows) {
  const report = "results/report.json";
  if (!existsSync(report)) return [];
  const seen = new Set(rows.map((r) => r.file));
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.at(-1);
        const file = fileOf(spec.title);
        if (!file || seen.has(file) || !last || !["timedOut", "failed", "interrupted"].includes(last.status)) continue;
        const why = last.status === "timedOut" ? `The test hit its time limit (${Math.round((last.duration ?? 0) / 1000)}s) before it could capture the screen.` : `The test stopped with an error: ${(last.error?.message ?? "unknown").split("\n")[0]}`;
        out.push({ file, title: spec.title, reason: why });
        seen.add(file);
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  JSON.parse(readFileSync(report, "utf8")).suites?.forEach(walk);
  return out;
}

async function main() {
  if (process.env.MANUAL_TICKETS === "false") return;
  const rows = readJsonl("results/verdicts.jsonl");
  const repairs = new Map(readJsonl("results/repairs.jsonl").map((r) => [r.file, r]));

  const todo = [
    // Unreachable and not repaired (a repaired script has its own review and pull request)
    ...rows
      .filter((r) => r.unreachable && !repairs.get(r.file)?.repaired)
      .map((r) => ({
        file: r.file,
        title: r.title,
        assetId: r.assetId,
        reason: `The script could not reach the screen. Step that failed: ${r.failedStep ?? "unknown"}${repairs.has(r.file) ? ". AI script repair did not find a working fix." : ". AI script repair did not run for it."}`,
      })),
    // Blocked for a reason a person can act on (not an expired sign-in)
    ...rows
      .filter((r) => r.verdict === "blocked" && !signIn.test(r.failedStep ?? ""))
      .map((r) => ({ file: r.file, title: r.title, assetId: r.assetId, reason: `The screenshot was blocked: ${r.failedStep}` })),
    // Crashed or timed out without writing a result
    ...crashedTests(rows),
  ];
  if (!todo.length) return;

  // Recipe details for the ticket (and the asset ID for crashed tests)
  const { data: recipes, error } = await db()
    .from("screenshot_recipes")
    .select("asset_id, script_path, start_url, preconditions, steps, capture, must_show, page_tweaks")
    .in("script_path", todo.map((t) => `recipes/${t.file}.spec.ts`));
  if (error) throw new Error(`Could not read screenshot_recipes: ${error.message}`);
  const byPath = new Map((recipes ?? []).map((r) => [r.script_path, r]));
  // The recipes write the test site as {test_site}
  const { data: settings } = await db().from("recipe_settings").select("key, value");
  const site = (settings ?? []).find((r) => r.key === "test_site")?.value ?? process.env.TEST_SITE ?? "{test_site}";
  const fill = (t) => String(t).replaceAll("{test_site}", site);

  const lines = ["\n## Manual capture", "", "| Screenshot | Ticket | Why it was not captured |", "|---|---|---|"];
  for (const t of todo) {
    const recipe = byPath.get(`recipes/${t.file}.spec.ts`);
    const assetId = t.assetId ?? recipe?.asset_id;
    let ticket = "";
    if (!assetId) {
      ticket = "not created: no screenshot_recipes row for this script";
    } else {
      const howTo = [
        `Why it could not be captured automatically: ${t.reason}`,
        ...(recipe?.start_url ? [`Start at: ${fill(recipe.start_url)}`] : []),
        ...(recipe?.preconditions ? [`Before you start: ${fill(recipe.preconditions)}`] : []),
        ...(recipe?.steps ?? []).map((s, i) => `Step ${i + 1}: ${fill(s)}`),
        ...(recipe?.capture ? [`Capture: ${recipe.capture}`] : []),
        ...(recipe?.must_show?.length ? [`The capture must show: ${recipe.must_show.join("; ")}`] : []),
        ...(recipe?.page_tweaks?.length ? [`Before capturing: ${recipe.page_tweaks.join(" ")}`] : []),
        `Then fix or re-run the script (recipes/${t.file}.spec.ts) so the next monthly check captures it again.`,
      ];
      try {
        const { ok, body } = await sendToShot({ assetId, verdict: "manual_capture", changes: howTo, dryRun });
        ticket = ok ? (body.key ? `${body.key}${body.status === "duplicate" ? " (already open)" : ""}` : body.status) : `failed: ${body.error ?? "unknown"}`;
      } catch (e) {
        ticket = `failed: ${e.message}`;
      }
    }
    console.log(`${t.title}: ${ticket}`);
    lines.push(`| ${cell(t.title)} | ${cell(ticket)} | ${cell(t.reason)} |`);
  }
  summary(lines.join("\n") + "\n" + (dryRun ? "\n_Dry run: no tickets were created._\n" : ""));
}

main().catch((e) => {
  console.error(e);
  summary(`\n_Manual capture tickets failed: ${cell(e.message)}_\n`);
  process.exit(1);
});
