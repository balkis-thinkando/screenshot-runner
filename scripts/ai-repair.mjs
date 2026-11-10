// AI script repair (runs after the AI review in CI).
// For each screenshot whose script could not reach its screen (logged as unreachable by lib/recipe.ts),
// Claude gets the recipe, the script, the step that failed and a snapshot of the page at that moment
// (accessibility tree + screenshot) and writes a corrected script. The script is tested on the live test
// site (navigation only, read-only); a failed attempt goes back to Claude with the new snapshot.
// When a repaired script reaches the screen:
//   1. its capture gets the usual AI review (scripts/ai-review.mjs). A changed path counts as a change:
//      when the steps a learner follows changed, the verdict is at least steps_broken;
//   2. the run in public.recipe_runs is updated and material/steps_broken create a SHOT work item with
//      the ai-repaired label and a line saying how the steps changed;
//   3. a pull request with the fixed script is opened. It is never merged automatically.
// The run still fails (scripts/summary.mjs), so the owner is emailed and reviews the pull request.
//
// Safety: the AI-written script runs without the Supabase, Anthropic and GitHub secrets in its
// environment, and is rejected unless it only imports @playwright/test and ../lib/*, keeps the recipe's
// identity, and uses no file, process, network or eval APIs or non-Atlassian URLs.
//
// Env: ANTHROPIC_API_KEY (skips the repair when missing), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      AI_REPAIR_DRY_RUN=true (tests the repair but changes nothing: no Supabase updates, tickets or pull
//      requests; the diff is shown in the job summary), MAX_REPAIRS (default 5 per run),
//      MAX_ATTEMPTS (default 3 per script), GH_TOKEN (pull requests), AI_REPAIR_FIXTURE (testing only:
//      a JSON file { attempts: [answer, ...], review?: { verdict, summary, changes } } used instead of
//      calling Claude; with it, nothing is updated, ticketed or pushed).

import Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cell, db, MODEL, review, summary } from "./ai-review.mjs";
import { sendToShot } from "./shot.mjs";

const maxRepairs = Number(process.env.MAX_REPAIRS ?? 5);
const maxAttempts = Number(process.env.MAX_ATTEMPTS ?? 3);
const fixture = process.env.AI_REPAIR_FIXTURE ? JSON.parse(readFileSync(process.env.AI_REPAIR_FIXTURE, "utf8")) : null;
const dryRun = process.env.AI_REPAIR_DRY_RUN === "true" || !!fixture;
const hasDb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const readJsonl = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

const broken = readJsonl("results/verdicts.jsonl").filter((r) => r.unreachable);
if (!broken.length) {
  console.log("Every script reached its screen: nothing to repair.");
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY && !fixture) {
  console.log("ANTHROPIC_API_KEY is not set: skipping the AI script repair.");
  summary("\n_AI script repair skipped: the ANTHROPIC_API_KEY secret is not set._\n");
  process.exit(0);
}
if (broken.length > maxRepairs) console.log(`${broken.length} scripts did not reach their screen; repairing the first ${maxRepairs} (MAX_REPAIRS).`);

const client = new Anthropic();

const SYSTEM = `You repair Playwright scripts that recreate screenshots for Atlassian University lessons.
Each script (a "recipe" file) opens a screen on an Atlassian test site, applies display-only page tweaks, runs
checks and captures the screen. The script below stopped before the capture: the product UI probably changed
(a page moved, a menu item was renamed, a selector no longer matches). You get the recipe (the lesson's
plain-English steps), the script, the shared helpers it imports, the error and a snapshot of the page when it
stopped (URL, accessibility tree, screenshot).

Write the complete corrected script file:
- Fix only what stops the script from reaching the screen. Keep file, assetId, title, product, tweaks,
  checks, mask and clip unless they cannot work on the new UI. Never weaken or remove a check to make it pass:
  checks report differences, they are meant to fail when the UI differs from the lesson.
- Do not edit the shared helpers in lib/. If a helper's navigation is broken, write a local navigate function
  in the script instead (it may still use other helpers).
- Prefer role- and text-based locators (getByRole, getByText) or data-testid seen in the accessibility tree.
- Navigation is read-only: open pages, menus and panels only. Never click Save, Create, Delete, Submit or
  anything that changes data or settings.
- Only import from "@playwright/test" and "../lib/...". Do not use process, fs, child_process, fetch, eval or
  URLs outside Atlassian sites. Use the Settings argument (s.test_site, s.test_org) for site addresses.
- Keep the file's header comment and code style.

Also say whether the steps a learner would follow to reach the screen changed (another page, menu or item
name), as opposed to only selectors or timing in the script. If they changed, describe the new path in one
plain sentence (for example "Billing is now under Billing and subscriptions > Overview."). Never name real
people. Do not use em dashes.`;

const SCHEMA = {
  type: "object",
  properties: {
    diagnosis: { type: "string", description: "Why the script stopped, in one or two sentences." },
    steps_changed: { type: "boolean", description: "True when the path a learner follows to reach the screen changed." },
    steps_change: { type: "string", description: "The new path in one sentence when steps_changed; otherwise empty." },
    script: { type: "string", description: "The complete corrected script file." },
  },
  required: ["diagnosis", "steps_changed", "steps_change", "script"],
  additionalProperties: false,
};

/** Shared helpers the script imports (context only; Claude does not edit them). */
function helperSources(script) {
  const libs = [...new Set([...script.matchAll(/from\s+["']\.\.\/lib\/([\w-]+)["']/g)].map((m) => m[1]))];
  return libs.map((l) => `--- lib/${l}.ts ---\n${readFileSync(`lib/${l}.ts`, "utf8")}`).join("\n\n");
}

async function recipeRow(assetId) {
  if (!hasDb) return null;
  const { data } = await db()
    .from("screenshot_recipes")
    .select("start_url, steps, preconditions, capture, must_show, notes")
    .eq("asset_id", assetId)
    .maybeSingle();
  return data;
}

/** Text + images describing where the script stopped. */
function failureContent(intro, snap) {
  const content = [{ type: "text", text: `${intro}\nURL when it stopped: ${snap?.url ?? "unknown"}\nError:\n${snap?.error ?? "unknown"}` }];
  if (snap?.screenshot && existsSync(snap.screenshot)) {
    content.push({ type: "text", text: "Screenshot when it stopped:" });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(snap.screenshot).toString("base64") } });
  }
  if (snap?.ariaTree && existsSync(snap.ariaTree)) content.push({ type: "text", text: `Accessibility tree when it stopped:\n${readFileSync(snap.ariaTree, "utf8")}` });
  return content;
}

/** One answer from Claude (or the next canned answer in testing). Returns the answer and the assistant turn. */
async function ask(messages, attempt) {
  if (fixture) {
    const answer = fixture.attempts[attempt - 1];
    if (!answer) throw new Error(`AI_REPAIR_FIXTURE has no answer for attempt ${attempt}`);
    return { answer, turn: { role: "assistant", content: JSON.stringify(answer) } };
  }
  const response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages,
    })
    .finalMessage();
  if (response.stop_reason === "refusal") throw new Error(`Repair declined (${response.stop_details?.category ?? "no category"})`);
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`No answer (stop reason ${response.stop_reason})`);
  return { answer: JSON.parse(text), turn: { role: "assistant", content: response.content } };
}

const ALLOWED_HOSTS = /^([\w-]+\.)*(atlassian\.(com|net)|orangelogic\.com)$/;

/** Reasons the AI-written script may not run; empty when it is fine. */
function rejectReasons(script, original) {
  const reasons = [];
  for (const [, from] of script.matchAll(/(?:import|export)[^;]*?from\s+["']([^"']+)["']/g)) {
    if (from !== "@playwright/test" && !/^\.\.\/lib\/[\w-]+$/.test(from)) reasons.push(`imports "${from}"`);
  }
  const banned = {
    process: /process\s*[.[]/,
    child_process: /child_process/,
    require: /\brequire\s*\(/,
    "dynamic import": /\bimport\s*\(/,
    eval: /\beval\s*\(|new\s+Function/,
    fetch: /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/,
    "network routing or API requests": /\.route\s*\(|page\.request|\brequest\.(get|post|fetch)/,
    "file uploads": /\.setInputFiles\s*\(/,
    "file access": /\b(writeFile|readFile|unlink|rmSync)/,
  };
  for (const [name, re] of Object.entries(banned)) if (re.test(script)) reasons.push(`uses ${name}`);
  for (const [, host] of script.matchAll(/https?:\/\/([^/\s"'`]+)/g)) if (!ALLOWED_HOSTS.test(host)) reasons.push(`links to ${host}`);
  // The recipe's identity must not change (baseline name, Supabase row, schedule group)
  for (const key of ["file", "assetId", "product"]) {
    const was = original.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1];
    if (was && !script.includes(`${key}: "${was}"`)) reasons.push(`changes ${key} (must stay "${was}")`);
  }
  if (!/runRecipe\s*\(/.test(script)) reasons.push("does not call runRecipe");
  return reasons;
}

/** Runs one recipe file on the live site without secrets; returns its verdict line, or the output on a crash. */
function testScript(file, attempt, s) {
  const log = `results/repair-${file}-${attempt}.jsonl`;
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CI: process.env.CI ?? "",
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}),
    RECORD_RUNS: "false",
    TEST_SITE: s.test_site,
    TEST_ORG: s.test_org,
    DISPLAY_ORG_NAME: s.display_org_name,
    VERDICTS_FILE: log,
  };
  const run = spawnSync("npx", ["playwright", "test", `recipes/${file}.spec.ts`, "--retries=0", "--reporter=list", `--output=test-results/repair-${file}-${attempt}`], {
    env,
    encoding: "utf8",
    timeout: 6 * 60_000,
  });
  const line = readJsonl(log).at(-1) ?? null;
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.replace(/\u001b\[[0-9;]*m/g, "").trim();
  return { line, output: output.slice(-4000) };
}

async function testSettings() {
  const { TEST_SITE, TEST_ORG, DISPLAY_ORG_NAME } = process.env;
  if (TEST_SITE && TEST_ORG && DISPLAY_ORG_NAME) return { test_site: TEST_SITE, test_org: TEST_ORG, display_org_name: DISPLAY_ORG_NAME };
  const { data, error } = await db().from("recipe_settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

/** Tries up to maxAttempts scripts; returns the working one with its test result, or why it failed. */
async function repair(row, s) {
  const specPath = `recipes/${row.file}.spec.ts`;
  const original = readFileSync(specPath, "utf8");
  const recipe = await recipeRow(row.assetId);
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `Screenshot: ${row.title}`,
            `Recipe (lesson steps; {test_site} is ${s.test_site}):`,
            JSON.stringify(recipe ?? "not available", null, 2),
            "",
            `--- ${specPath} (the script to repair) ---`,
            original,
            "",
            "Shared helpers it imports (do not edit):",
            helperSources(original),
          ].join("\n"),
        },
        ...failureContent("The script stopped before the capture.", row.snapshot),
      ],
    },
  ];

  let last = "";
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { answer, turn } = await ask(messages, attempt);
      messages.push(turn);
      const reasons = rejectReasons(answer.script, original);
      if (reasons.length) {
        last = `Attempt ${attempt} rejected: ${reasons.join("; ")}`;
        console.log(`${row.file}: ${last}`);
        messages.push({ role: "user", content: `That script was not run because it ${reasons.join("; ")}. Write it again within the rules.` });
        continue;
      }

      writeFileSync(specPath, answer.script);
      const { line, output } = testScript(row.file, attempt, s);
      if (line?.verdict === "blocked") return { ok: false, attempts: attempt, note: `Environment problem, not the script: ${line.failedStep}` };
      if (line && !line.unreachable && line.capturePath && existsSync(line.capturePath)) {
        console.log(`${row.file}: attempt ${attempt} reached the screen (${line.verdict}).`);
        return { ok: true, attempts: attempt, answer, line };
      }
      last = line ? `Attempt ${attempt} stopped again: ${line.failedStep}` : `Attempt ${attempt} did not run (syntax or type error)`;
      console.log(`${row.file}: ${last}`);
      messages.push({
        role: "user",
        content: line
          ? failureContent("The corrected script stopped before the capture too.", line.snapshot)
          : [{ type: "text", text: `The corrected script did not run. Playwright output:\n${output}` }],
      });
    }
    return { ok: false, attempts: maxAttempts, note: last };
  } finally {
    writeFileSync(specPath, original); // the working tree keeps the original; the fix goes in a pull request
  }
}

const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
  return r.stdout.trim();
};

/** Opens a pull request with the fixed script on its own branch; returns its URL. */
function openPullRequest(row, fixed, body) {
  const specPath = `recipes/${row.file}.spec.ts`;
  const base = process.env.GITHUB_REF_NAME ?? git("rev-parse", "--abbrev-ref", "HEAD");
  const branch = `ai-repair/${row.file}-${process.env.GITHUB_RUN_ID ?? Date.now()}`;
  const start = git("rev-parse", "HEAD");
  const startBranch = git("rev-parse", "--abbrev-ref", "HEAD");
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  git("switch", "-c", branch);
  try {
    writeFileSync(specPath, fixed);
    git("add", specPath);
    git("commit", "-m", `AI repair: ${row.file} reaches its screen again`);
    git("push", "-u", "origin", branch);
  } finally {
    if (startBranch === "HEAD") git("switch", "--detach", start);
    else git("switch", startBranch);
    git("restore", "--source", start, "--", specPath);
  }
  const bodyFile = `results/pr-${row.file}.md`;
  writeFileSync(bodyFile, body);
  const pr = spawnSync("gh", ["pr", "create", "--base", base, "--head", branch, "--title", `AI repair: ${row.title}`, "--body-file", bodyFile], { encoding: "utf8" });
  if (pr.status !== 0) throw new Error(`Branch ${branch} pushed, but the pull request was not created: ${(pr.stderr || pr.stdout).trim().slice(0, 300)}`);
  return pr.stdout.trim().split("\n").at(-1);
}

function diff(file, fixed) {
  mkdirSync("results/repairs", { recursive: true });
  const out = `results/repairs/${file}.spec.ts`;
  writeFileSync(out, fixed);
  return spawnSync("diff", ["-u", `recipes/${file}.spec.ts`, out], { encoding: "utf8" }).stdout;
}

const s = await testSettings();
const lines = ["\n## AI script repair", "", "| Screenshot | Repair | Steps changed | AI verdict | Ticket | Pull request | Note |", "|---|---|---|---|---|---|---|"];
const details = [];
let failures = 0;

for (const row of broken.slice(0, maxRepairs)) {
  const out = { file: row.file, repaired: false, stepsChanged: "", verdict: "needs_review", ticket: "", pr: "", note: "" };
  try {
    const result = await repair(row, s);
    out.note = result.ok ? result.answer.diagnosis : result.note;
    if (result.ok) {
      const { answer, line } = result;
      out.repaired = true;
      out.attempts = result.attempts;
      out.stepsChanged = answer.steps_changed ? answer.steps_change : "";
      const patch = diff(row.file, answer.script);
      details.push(`<details><summary>${row.file}: script changes (attempt ${result.attempts})</summary>\n\n\`\`\`diff\n${patch}\n\`\`\`\n</details>\n`);

      // Usual AI review of the new capture; a changed path is a change too
      const pathNote = answer.steps_changed
        ? [`Path to the screen: the lesson's steps no longer reach it. New path: ${answer.steps_change} Count this as a change (at least steps_broken) and list it.`]
        : ["Path to the screen: unchanged for learners (the script only needed new selectors or waits)."];
      const rev = fixture?.review
        ? { ...fixture.review, lessonImage: null }
        : await review({ ...row, checks: line.checks, capturePath: line.capturePath }, pathNote);
      out.verdict = answer.steps_changed && ["unchanged", "cosmetic"].includes(rev.verdict) ? "steps_broken" : rev.verdict;
      out.summary = rev.summary;
      console.log(`${row.title}: ${out.verdict}\n  ${rev.changes.join("\n  ")}`);

      if (!dryRun && row.runId) {
        const { error } = await db()
          .from("recipe_runs")
          .update({ verdict: out.verdict, summary: `AI repair (${answer.diagnosis}) then AI review: ${rev.summary}` })
          .eq("id", row.runId);
        if (error) throw error;
      }
      if (["material", "steps_broken"].includes(out.verdict)) {
        if (dryRun) out.ticket = "(dry run)";
        else {
          const { ok, body } = await sendToShot({
            assetId: row.assetId,
            verdict: out.verdict,
            changes: rev.changes,
            png: line.capturePath,
            lessonImage: rev.lessonImage,
            aiReviewed: true,
            aiRepaired: true,
            stepsChanged: out.stepsChanged,
          });
          if (!ok) throw new Error(`Ticket not created: ${body.error ?? JSON.stringify(body)}`);
          out.ticket = body.status === "duplicate" ? `${body.key} (already open)` : body.key;
        }
      }

      const prBody = [
        `The monthly check could not reach the screen for **${row.title}**, so Claude repaired the script and tested it on the test site (attempt ${result.attempts} of ${maxAttempts}).`,
        "",
        "| | |",
        "|---|---|",
        `| Why it stopped | ${cell(row.failedStep)} |`,
        `| Diagnosis | ${cell(answer.diagnosis)} |`,
        `| Steps for learners changed | ${answer.steps_changed ? cell(answer.steps_change) : "No (selectors or waits only)"} |`,
        `| Repaired run | ${line.verdict === "unchanged" ? "unchanged (all checks pass, matches the baseline)" : `needs_review: ${cell(line.failed.join("; "))}`} |`,
        `| AI review | ${out.verdict}: ${cell(rev.summary)} |`,
        `| SHOT ticket | ${out.ticket || "none"} |`,
        "",
        "Review the change before merging: checks must still describe the lesson, and navigation must stay read-only. This pull request is never merged automatically.",
        "",
        "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      ].join("\n");
      out.pr = dryRun ? "(dry run)" : openPullRequest(row, answer.script, prBody);
    }
  } catch (e) {
    failures++;
    out.note = e instanceof Anthropic.APIError ? `Claude API error ${e.status}: ${e.message}` : `Repair failed: ${e.message}`;
    console.error(`${row.title}: ${out.note}`);
  }
  writeFileSync("results/repairs.jsonl", JSON.stringify(out) + "\n", { flag: "a" });
  lines.push(
    `| ${cell(row.title)} | ${out.repaired ? `repaired (attempt ${out.attempts})` : "not repaired"} | ${cell(out.stepsChanged || (out.repaired ? "no" : ""))} | ${out.verdict} | ${cell(out.ticket)} | ${cell(out.pr)} | ${cell(out.note)} |`,
  );
}
for (const row of broken.slice(maxRepairs)) lines.push(`| ${cell(row.title)} | skipped (MAX_REPAIRS) | | needs_review | | | ${cell(row.failedStep)} |`);

const md = [lines.join("\n"), "", ...details].join("\n") + "\n";
console.log(md);
summary(md);
if (failures) process.exit(1);
