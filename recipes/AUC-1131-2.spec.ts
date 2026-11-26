// Lesson:  AUC-1131 - Create a board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-create-a-board-in-jira
// Image:   #2, section "Create a board" (scrum board on Active sprints; the space is expanded in the sidebar and its
//          boards and the View all boards link are outlined, an arrow points at them)
//          https://dam-cdn.atl.orangelogic.com/public/AT138K.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT138K'
// Opens MOBL Cowboys in Mobile Dev, a space with two scrum boards (MOBL Cowboys, MOBL Baltimore), so the expanded
// space lists several boards like the lesson's Community & Learning space (five boards). Outlines the space row and
// its board list.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, MULTI, openBoard, sidebarBoard, sidebarBoards, sidebarSpace } from "../lib/b3-jboards";

runRecipe({
  file: "AUC-1131-2",
  assetId: "AT138K",
  title: "AUC-1131 #2 - Space boards in the sidebar",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, MULTI);
    await sidebarBoards(page).waitFor({ timeout: 30_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [[sidebarSpace(page, MULTI), sidebarBoards(page)]]);
  },

  mask: (page) => [page.locator('[data-testid="software-board.board-area"]')],

  async checks(page, c) {
    await c.check("Space expanded in the sidebar, listing its boards (lesson: 5 boards)", async () => {
      const space = await sidebarSpace(page, MULTI).isVisible().catch(() => false);
      const boards = await sidebarBoards(page).locator('[data-testid^="NAV4_boar_"][data-testid$="-container"]').count();
      return { pass: space && boards >= 2, detail: `Space row: ${space}; ${boards} boards listed (test data: the space has 2 boards)` };
    });

    await c.check("Current board selected in the list", async () => {
      const current = await sidebarBoard(page, MULTI).locator('[aria-current="page"]').count();
      return { pass: current > 0, detail: current ? "Selected" : "Not marked as current" };
    });

    await c.check("'View all boards' link under the boards", async () => {
      const v = await page.locator('[data-testid="page-layout.sidebar"]').getByText("View all boards", { exact: true }).first().isVisible().catch(() => false);
      const recent = await sidebarBoards(page).getByText("Recent", { exact: true }).first().isVisible().catch(() => false);
      return {
        pass: v,
        detail: v ? "Present" : `Missing${recent ? " (UI change: the space lists its Recent boards only, without View all boards)" : ""}`,
      };
    });

    await boardHeaderChecks(page, c, MULTI, "Active sprints", false);
  },
});
