// Lesson:  AUC-1691 - Use a scrum board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-use-jira-scrum-board
// Image:   #1, section "What's a scrum board?" (scrum board on Active sprints; the board link in the sidebar and the
//          Active sprints tab are outlined, an arrow runs from the sidebar to the board)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/55yk6j28pl61s4em4m87211t607ee81u.png
// Recipe:  public.screenshot_recipes where asset_id = '55yk6j28pl61s4em4m87211t607ee81u'
// Opens TH board (M0004 - Team Horizon), a scrum board with an active sprint and the lesson's three columns, and
// outlines the board link in the sidebar and the Active sprints tab. Stand-in for the lesson's AP board.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, columnNames, openBoard, SCRUM, sidebarBoard, sidebarSpace, tab, tabLabels } from "../lib/b3-jboards";

runRecipe({
  file: "AUC-1691-1",
  assetId: "55yk6j28pl61s4em4m87211t607ee81u",
  title: "AUC-1691 #1 - Scrum board link and Active sprints tab",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, SCRUM);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [sidebarBoard(page, SCRUM), tab(page, "Active sprints")]);
  },

  mask: (page) => [page.locator('[data-testid="software-board.board-area"]')],

  async checks(page, c) {
    await c.check("Board link under its space in the sidebar, selected", async () => {
      const space = await sidebarSpace(page, SCRUM).isVisible().catch(() => false);
      const link = sidebarBoard(page, SCRUM);
      const shown = await link.isVisible().catch(() => false);
      const current = await link.locator('[aria-current="page"]').count();
      return { pass: space && shown && current > 0, detail: `Space row: ${space}; board link: ${shown}; selected: ${current > 0}` };
    });

    await c.check("Tabs: Summary, Timeline, Backlog, Active sprints, Calendar, Reports, List", async () => {
      const tabs = await tabLabels(page);
      const missing = ["Summary", "Timeline", "Backlog", "Active sprints", "Calendar", "Reports", "List"].filter((t) => !tabs.includes(t));
      return { pass: !missing.length, detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}tabs: ${tabs.join(", ")}` };
    });

    await boardHeaderChecks(page, c, SCRUM, "Active sprints", false);

    await c.check("Columns: To Do, In Progress, Done", async () => {
      const cols = await columnNames(page);
      const missing = ["TO DO", "IN PROGRESS", "DONE"].filter((x) => !cols.includes(x));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });
  },
});
