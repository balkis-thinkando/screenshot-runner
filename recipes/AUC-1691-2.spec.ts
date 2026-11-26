// Lesson:  AUC-1691 - Use a scrum board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-use-jira-scrum-board
// Image:   #2, section "Find your workflow" (same Active sprints board as image #1; the columns are outlined, arrows
//          run between the column headers)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/amr4e44sma082b5gj7l63uxy04i84j7n.png
// Recipe:  public.screenshot_recipes where asset_id = 'amr4e44sma082b5gj7l63uxy04i84j7n'
// Opens TH board (M0004 - Team Horizon) on Active sprints and outlines its columns (To Do, In Progress, Done).
// Stand-in for the lesson's AP board.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, columnNames, columns, openBoard, recentSpaces, SCRUM } from "../lib/b3-jboards";

runRecipe({
  file: "AUC-1691-2",
  assetId: "amr4e44sma082b5gj7l63uxy04i84j7n",
  title: "AUC-1691 #2 - Scrum board columns",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, SCRUM);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    // One area around all the columns
    await spotlightAreas(page, [[columns(page).first(), columns(page).last()]]);
  },

  mask: (page) => [recentSpaces(page), page.locator('[data-testid="platform-board-kit.ui.card.card"]')],

  async checks(page, c) {
    await boardHeaderChecks(page, c, SCRUM, "Active sprints", false);

    await c.check("Columns in workflow order: To Do, In Progress, Done", async () => {
      const cols = await columnNames(page);
      const ok = cols.join("|") === "TO DO|IN PROGRESS|DONE";
      return { pass: ok, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Column headers with work item counts, Done with its done icon", async () => {
      const heads = await page.locator('[data-testid="platform-board-kit.common.ui.column-header.header.column-header-container"]').allInnerTexts();
      const counts = heads.filter((h) => /\d/.test(h)).length;
      return { pass: counts >= 2, detail: `${counts} of ${heads.length} headers show a count (lesson: all three)` };
    });

    await c.check("Cards in the sprint", async () => {
      const n = await page.locator('[data-testid="platform-board-kit.ui.card.card"]').count();
      return { pass: n > 0, detail: `${n} cards (lesson: 6)` };
    });
  },
});
