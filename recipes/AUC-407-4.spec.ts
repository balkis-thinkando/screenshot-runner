// Lesson:  AUC-407 - Create whiteboards in Confluence
//          https://community.atlassian.com/learning/lesson/create-whiteboards-in-confluence
// Image:   #4, section "Use whiteboard tools": the "Sticky Note Board" with the bottom toolbar outlined and a
//          marker on each tool (select/hand, sticky note, pen, text, line, shape, section, stamp, Jira import,
//          template, more)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2eo27cd431d02g6m1yyykwny1q52p648.png
// Recipe:  public.screenshot_recipes where asset_id = '2eo27cd431d02g6m1yyykwny1q52p648'
// Needs test data: there is no "Sticky Note Board" on the site (Nov 2026). The recipe uses the closest board with
// sticky notes, the SyncUp brainstorming mind map (lib/b2-search.ts WHITEBOARDS.mindmap). Nothing on the board
// is clicked. The bottom toolbar is outlined; the per-tool markers are not drawn.

import { runRecipe } from "../lib/recipe";
import { boardFrame, boardTools, bottomTools, LABELLED_TOOLS, openBoard, outlineBoardAreas, toolPreviews, WHITEBOARDS } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

const WB = WHITEBOARDS.mindmap;
// The lesson's tools after the select/hand pair: sticky note, pen, text, line, shape | section, stamp, Jira import, template | more
const LESSON_TOOL_COUNT = 10;

runRecipe({
  file: "AUC-407-4",
  assetId: "2eo27cd431d02g6m1yyykwny1q52p648",
  title: "AUC-407 #4 - Whiteboard bottom toolbar",
  product: "confluence",

  async navigate(page, s) {
    await openBoard(page, s, WB);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await outlineBoardAreas(page, [boardTools.bottom(page)]);
  },

  // "Edited 1d ago" (or "Saved") in the header changes over time; so do the colours of the sticky note and shape tools
  mask: (page) => [page.getByText(/^(Edited .+ ago|Saved)$/), toolPreviews(page)],

  async checks(page, c) {
    await c.check("Whiteboard title in the header", async () => {
      const title = await page.getByText(WB.title, { exact: true }).evaluateAll((es) => es.some((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().top < 120));
      return { pass: title, detail: title ? `Present (lesson board: "Sticky Note Board", not on the site)` : "Missing" };
    });

    await c.check("Bottom toolbar: section, stamp, Jira import, template, more", async () => {
      const found = await Promise.all(LABELLED_TOOLS.map((n) => boardFrame(page).getByRole("button", { name: n }).isVisible().catch(() => false)));
      const missing = LABELLED_TOOLS.filter((_, i) => !found[i]);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Same tools as the lesson (sticky note, pen, text, line, shape, section, stamp, Jira import, template, more)", async () => {
      const n = (await bottomTools(page)).tools;
      const table = await boardFrame(page).getByRole("button", { name: "Table", exact: true }).isVisible().catch(() => false);
      return { pass: n === LESSON_TOOL_COUNT && !table, detail: `${n} tools after select/hand (lesson: ${LESSON_TOOL_COUNT})${table ? '; new "Table" tool' : ""}` };
    });

    await c.check("Select and hand tools on the left of the toolbar", async () => {
      const n = (await bottomTools(page)).pointer;
      return { pass: n === 2, detail: `${n} items` };
    });
  },
});
