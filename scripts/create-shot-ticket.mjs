// Creates a SHOT work item by hand (see scripts/shot.mjs for auth). The capture is not stored anywhere else.
//
// node scripts/create-shot-ticket.mjs --asset <asset_id> --png <capture.png> --verdict material|steps_broken
//      --changes <changes.txt> [--dry-run]
// Rewrite an existing ticket's description instead (no new ticket, --png optional): add --issue SHOT-123
// Only add images to an existing ticket: --issue SHOT-123 --attach-only --png <capture.png>
// --lesson-image <url> also attaches a side-by-side of the lesson image and the new capture

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { sendToShot } from "./shot.mjs";

const { values: a } = parseArgs({
  options: {
    asset: { type: "string" },
    png: { type: "string" },
    verdict: { type: "string" },
    changes: { type: "string" },
    issue: { type: "string" },
    "attach-only": { type: "boolean", default: false },
    "lesson-image": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const need = a["attach-only"] ? ["asset", "issue", "png"] : ["asset", "verdict", "changes", ...(a.issue ? [] : ["png"])];
for (const k of need) if (!a[k]) throw new Error(`--${k} is required`);

const { ok, body } = await sendToShot({
  assetId: a.asset,
  verdict: a.verdict ?? "material",
  changes: a.changes ? readFileSync(a.changes, "utf8") : "-",
  png: a.png,
  issue: a.issue,
  attachOnly: a["attach-only"],
  lessonImage: a["lesson-image"],
  dryRun: a["dry-run"],
});
console.log(JSON.stringify(body, null, 2));
if (!ok) process.exit(1);
