// Summarises results/verdicts.jsonl after a run. Writes a table to the GitHub job summary
// (when GITHUB_STEP_SUMMARY is set) and exits 1 when the run needs the owner's attention:
// a blocked screenshot (expired sign-in, missing org or test data) or no results at all.
// needs_review is not a failure: those go to AI review and, if needed, a SHOT ticket.

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const file = "results/verdicts.jsonl";
const rows = existsSync(file)
  ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

const count = (v) => rows.filter((r) => r.verdict === v).length;
const lines = [
  `## Screenshot check: ${rows.length} screenshot(s)`,
  "",
  `Unchanged: ${count("unchanged")} · Needs review: ${count("needs_review")} · Blocked: ${count("blocked")}`,
  "",
  "| Screenshot | Verdict | Detail |",
  "|---|---|---|",
  ...rows.map((r) => `| ${r.title} | ${r.verdict} | ${(r.failedStep ?? r.failed.join("; ")) || ""} |`),
];
const md = lines.join("\n") + "\n";
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

if (!rows.length) {
  console.error("No results: the run did not reach any screenshot. Check the Playwright step log.");
  process.exit(1);
}
if (count("blocked")) {
  console.error("Blocked: fix the environment (usually an expired sign-in: refresh the AUTH_STATE_JSON secret).");
  process.exit(1);
}
