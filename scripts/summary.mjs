// Summarises results/verdicts.jsonl after a run. Writes a table to the GitHub job summary
// (when GITHUB_STEP_SUMMARY is set) and exits 1 when the run needs the owner's attention:
// a blocked screenshot (expired sign-in, missing org or test data), a screen the script could not reach
// (even when scripts/ai-repair.mjs repaired it: the fix waits in a pull request), a runner error, or no
// results at all. Other needs_review results are not a failure: those go to AI review and, if needed, a
// SHOT ticket.

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const file = "results/verdicts.jsonl";
const rows = existsSync(file)
  ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

const count = (v) => rows.filter((r) => r.verdict === v).length;
const unreachable = rows.filter((r) => r.unreachable);
// One table cell: no colour codes, line breaks, pipes or email addresses; first 300 characters
const cell = (t) =>
  (t ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "/")
    .slice(0, 300);
const lines = [
  `## Screenshot check: ${rows.length} screenshot(s)`,
  "",
  `Unchanged: ${count("unchanged")} · Needs review: ${count("needs_review")} (screen not reached: ${unreachable.length}) · Blocked: ${count("blocked")} · Errors: ${count("error")}`,
  "",
  "| Screenshot | Verdict | Detail |",
  "|---|---|---|",
  ...rows.map((r) => `| ${r.title} | ${r.unreachable ? "screen not reached" : r.verdict} | ${cell(r.failedStep ?? r.failed.join("; "))} |`),
];
const md = lines.join("\n") + "\n";
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

if (!rows.length) {
  console.error("No results: the run did not reach any screenshot (often a test timeout). Check the Playwright step log.");
  process.exit(1);
}
if (count("error")) {
  console.error("Runner error: see the Detail column (often a wrong SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret).");
  process.exit(1);
}
if (unreachable.length) {
  console.error(`Screen not reached: ${unreachable.map((r) => r.file).join(", ")}. See the AI script repair table for the fix (a pull request to review) or what is left to do by hand.`);
  process.exit(1);
}
if (count("blocked")) {
  console.error("Blocked: fix the environment (usually an expired sign-in: refresh the AUTH_STATE_JSON secret).");
  process.exit(1);
}
