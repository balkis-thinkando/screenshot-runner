// Lesson:  AUC-1690 - Use a kanban board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-use-a-kanban-board-in-jira
// Image:   #2, section "View a kanban board in Jira" (kanban board; the board link in the sidebar and the Kanban board
//          tab are outlined, an arrow runs from the sidebar to the board)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/7wu85ja3t3712h7i4ua345kvs101x77p.png
// Recipe:  public.screenshot_recipes where asset_id = '7wu85ja3t3712h7i4ua345kvs101x77p'
// Opens MP board (Mobile Program), a kanban board grouped by Query like the lesson's AG board, and outlines the board
// link under the space in the sidebar and the Kanban board tab.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import {
  boardHeaderChecks, boardTweaks, columnNames, KANBAN, openBoard, recentSpaces, sidebarBoard, sidebarSpace, swimlanes, tab,
} from "../lib/b3-jboards";

runRecipe({
  file: "AUC-1690-2",
  assetId: "7wu85ja3t3712h7i4ua345kvs101x77p",
  title: "AUC-1690 #2 - Kanban board link and tab",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, KANBAN);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [sidebarBoard(page, KANBAN), tab(page, "Kanban board")]);
  },

  mask: (page) => [page.locator('[data-testid="software-board.board-area"]')],

  async checks(page, c) {
    await c.check("Board link under its space in the sidebar, selected", async () => {
      const space = await sidebarSpace(page, KANBAN).isVisible().catch(() => false);
      const link = sidebarBoard(page, KANBAN);
      const shown = await link.isVisible().catch(() => false);
      const current = await link.locator('[aria-current="page"]').or(link.locator('xpath=self::*[@aria-current="page"]')).count();
      return { pass: space && shown && current > 0, detail: `Space row: ${space}; board link: ${shown}; selected: ${current > 0}` };
    });

    await boardHeaderChecks(page, c, KANBAN, "Kanban board", true);

    await c.check("Board grouped into swimlanes with columns Backlog, Selected for Development, In Progress, Done", async () => {
      const lanes = await swimlanes(page).count();
      const cols = await columnNames(page);
      const missing = ["BACKLOG", "SELECTED FOR DEVELOPMENT", "IN PROGRESS", "DONE"].filter((x) => !cols.includes(x));
      return { pass: lanes > 0 && !missing.length, detail: `${lanes} swimlanes; columns: ${cols.join(", ")}` };
    });
  },
});
