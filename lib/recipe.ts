import { test, expect, Page, Locator } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { db, settings, Settings } from "./supabase";

export type CheckResult = { check: string; result: "pass" | "fail"; detail: string };

/** Collects results for each must-show check instead of stopping at the first failure. */
export class Checks {
  results: CheckResult[] = [];
  async check(name: string, fn: () => Promise<{ pass: boolean; detail: string }>) {
    try {
      const { pass, detail } = await fn();
      this.results.push({ check: name, result: pass ? "pass" : "fail", detail });
    } catch (e) {
      this.results.push({ check: name, result: "fail", detail: `Check could not run: ${(e as Error).message}` });
    }
  }
  get allPassed() {
    return this.results.every((r) => r.result === "pass");
  }
}

/** Raised by a recipe when the environment, not the product, is the problem. */
export class Blocked extends Error {}

export type Recipe = {
  file: string; // e.g. AUC-330-2 — also the baseline image name
  assetId: string; // links to public.screenshot_recipes.asset_id
  title: string;
  product: string; // schedule group, e.g. "admin"; run one group with --grep @admin (see schedule.json)
  navigate: (page: Page, s: Settings) => Promise<void>;
  tweak: (page: Page, s: Settings) => Promise<void>;
  checks: (page: Page, c: Checks, s: Settings) => Promise<void>;
  mask?: (page: Page) => Locator[]; // dynamic areas ignored when comparing to the baseline
  clip?: { x: number; y: number; width: number; height: number }; // capture only this part of the window
};

/**
 * Verdicts written to public.recipe_runs:
 *  unchanged    — every check passed and the capture matches the baseline. No AI needed.
 *  needs_review — a check failed, the capture differs, or a step failed. Goes to AI review.
 *  blocked      — sign-in expired, org not found, missing test data. Fix the environment.
 */
export function runRecipe(r: Recipe) {
  test(r.title, { tag: `@${r.product}` }, async ({ page }, info) => {
    let s: Settings;
    try {
      s = await settings();
    } catch (e) {
      logVerdict({ file: r.file, title: r.title, verdict: "error", failedStep: `Could not read recipe_settings: ${(e as Error).message}`, failed: [] });
      throw e;
    }
    const checks = new Checks();
    let verdict: "unchanged" | "needs_review" | "blocked" = "unchanged";
    let failedStep: string | null = null;
    let baselineMatch: boolean | null = null;
    let capturePath: string | null = null;

    try {
      await r.navigate(page, s);
      if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
    } catch (e) {
      verdict = e instanceof Blocked ? "blocked" : "needs_review";
      failedStep = (e as Error).message;
    }

    if (!failedStep) {
      try {
        await r.tweak(page, s);
        await r.checks(page, checks, s);
        // Capture for the ticket / AI review
        capturePath = info.outputPath(`${r.file}.png`);
        await page.screenshot({ path: capturePath, clip: r.clip });
      } catch (e) {
        verdict = "needs_review";
        failedStep = `Tweak or capture failed: ${(e as Error).message}`;
      }
    }

    if (!failedStep) {

      // Compare with the last approved capture, ignoring dynamic areas. With no baseline yet, Playwright
      // writes one without throwing, so a first run must not count as a match.
      const hasBaseline = existsSync(info.snapshotPath(`${r.file}.png`));
      try {
        await expect(page).toHaveScreenshot(`${r.file}.png`, {
          mask: r.mask?.(page) ?? [],
          clip: r.clip,
          maxDiffPixelRatio: 0.002,
        });
        baselineMatch = hasBaseline;
      } catch {
        baselineMatch = false;
      }
      if (!checks.allPassed || !baselineMatch) verdict = "needs_review";
    }

    // A failed attempt is retried (slow loads); only record the final attempt so a run isn't stored twice
    const finalAttempt = verdict === "unchanged" || info.retry >= info.project.retries;
    if (finalAttempt) {
      logVerdict({
        file: r.file,
        title: r.title,
        verdict,
        failedStep,
        failed: [
          ...checks.results.filter((c) => c.result === "fail").map((c) => c.check),
          ...(baselineMatch === false ? ["Capture differs from the reference image (or there is none yet)"] : []),
        ],
      });
      try {
        await record(r, s, { verdict, checks: checks.results, failedStep, baselineMatch, capturePath });
      } catch (e) {
        logVerdict({ file: r.file, title: r.title, verdict: "error", failedStep: `Could not record the run in Supabase: ${(e as Error).message}`, failed: [] });
        throw e;
      }
    }

    // Make the test report readable on its own
    await info.attach("check-results", { body: JSON.stringify(checks.results, null, 2), contentType: "application/json" });
    expect(verdict, failedStep ?? "See check-results attachment").toBe("unchanged");
  });
}

/** One line per screenshot for scripts/summary.mjs (job summary and alerts). */
function logVerdict(line: { file: string; title: string; verdict: string; failedStep: string | null; failed: string[] }) {
  mkdirSync("results", { recursive: true });
  appendFileSync("results/verdicts.jsonl", JSON.stringify(line) + "\n");
}

async function record(
  r: Recipe,
  s: Settings,
  run: { verdict: string; checks: CheckResult[]; failedStep: string | null; baselineMatch: boolean | null; capturePath: string | null },
) {
  if (process.env.RECORD_RUNS === "false") return;
  const { data: recipe, error } = await db().from("screenshot_recipes").select("id").eq("asset_id", r.assetId).single();
  if (error || !recipe) throw new Error(`No screenshot_recipes row for asset ${r.assetId}`);

  // Captures are never stored in Supabase; they only go to the SHOT work item as an attachment
  const { error: insErr } = await db().from("recipe_runs").insert({
    recipe_id: recipe.id,
    test_site: s.test_site,
    verdict: run.verdict,
    check_results: run.checks,
    failed_step: run.failedStep,
    baseline_match: run.baselineMatch,
    run_by: "playwright",
  });
  if (insErr) throw insErr;
}
