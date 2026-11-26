// Lesson:  AUC-1131 - Create a board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-create-a-board-in-jira
// Image:   #1, section "What types of boards can you create?" (kanban board of a software space; the Kanban board
//          tab and the board columns are outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT1357.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1357'
// Opens MP board (Mobile Program), the kanban board the lesson shows, and outlines the Kanban board tab and the
// columns. The board is grouped by Query, so swimlane headers (Expedite, Everything Else) show above the columns.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardArea, boardHeaderChecks, boardTweaks, columnNames, KANBAN, openBoard, recentSpaces, tab } from "../lib/b3-jboards";

const LESSON_COLUMNS = ["BACKLOG", "SELECTED FOR DEVELOPMENT", "IN PROGRESS", "DONE"];

runRecipe({
  file: "AUC-1131-1",
  assetId: "AT1357",
  title: "AUC-1131 #1 - Kanban board",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, KANBAN);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [tab(page, "Kanban board"), boardArea(page)]);
  },

  mask: (page) => [recentSpaces(page), page.locator('[data-testid="software-board.board-container.board.card-container.card-with-icc"]')],

  async checks(page, c) {
    await boardHeaderChecks(page, c, KANBAN, "Kanban board", true);

    await c.check("Columns: Backlog, Selected for Development, In Progress, Done", async () => {
      const cols = await columnNames(page);
      const missing = LESSON_COLUMNS.filter((x) => !cols.includes(x));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Cards in the columns", async () => {
      const n = await page.locator('[data-testid="platform-board-kit.ui.card.card"]').count();
      return { pass: n > 0, detail: `${n} cards (lesson: 4)` };
    });
  },
});
