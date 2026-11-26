// Lesson:  AUC-1753 - Prioritize work with the List view in Jira
//          https://community.atlassian.com/learning/lesson/using-jira-list-view
// Image:   #3, section "Add the List view to your space" (PLAT board, add view (+) menu with List chosen; List and
//          Add to navigation are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14MKA.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14MKA'
// The PLAT board with the add view (+) menu open. No view is added: nothing in the menu is clicked. The pointer rests
// on List, and List is shown as the chosen option with its lesson description (display only, see
// showAddViewOption in lib/b3-jsearch.ts; the illustration stays the first option's). Sidebar hidden, display only.
// The board's cards change over time, so the board is masked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import {
  addToNavigation, addViewChecks, addViewOption, fakeSpacePeople, hideJiraSidebar, openSpaceView, showAddViewOption, tabsCheck, VIEW_DESCRIPTIONS,
} from "../lib/b3-jsearch";

let offered = false;

runRecipe({
  file: "AUC-1753-3",
  assetId: "AT14MKA",
  title: "AUC-1753 #3 - Add view menu, List",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/c/projects/PLAT/boards/1", page.getByPlaceholder(/Search board/).first(), "the PLAT board");
    await hideJiraSidebar(page);
    offered = await showAddViewOption(page, "List", VIEW_DESCRIPTIONS.List);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, ["PLAT"]);
    if (offered) await spotlightAreas(page, [addViewOption(page, "List"), addToNavigation(page)]);
  },

  mask: (page) => [page.locator('[data-testid*="platform-board-kit.ui.board"], [data-testid*="board.content"]').first()],

  async checks(page, c) {
    await c.check("Space 'PLAT board' in Platform Development", async () => {
      const h = await page.getByRole("heading", { name: "PLAT board" }).first().isVisible().catch(() => false);
      const crumb = await page.locator('nav[aria-label="Breadcrumbs"]').innerText().catch(() => "");
      return { pass: h && crumb.includes("Platform Development"), detail: `Heading: ${h}; breadcrumb: "${crumb.replace(/\s+/g, " ").trim()}"` };
    });
    await tabsCheck(page, c, "Active sprints", ["Summary", "Timeline", "Backlog", "Active sprints", "Calendar", "Reports", "Forms", "Goals", "Components"]);
    await addViewChecks(page, c, "List", offered, ["Capacity", "Inbox", "List"]);
  },
});
