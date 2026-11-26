// Lesson:  AUC-1134 - Determine what displays on a Jira board using filters
//          https://community.atlassian.com/learning/lesson/filter-jira-board
// Image:   #4, section "Create quick filters" (Active sprints board; Quick filters menu open with Assigned to me,
//          Recently Updated and "Show quick filters" switched on, so the filters also show as buttons under the
//          search box; menu and buttons outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14P9T.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14P9T'
// Opens TH board (M0004 - Team Horizon), which has an active sprint (PLAT board, the lesson's board, has none), and
// opens the filters menu, now called Custom filters. The "Show custom filters" switch is off for the test account and
// is not switched on (it saves a preference), so the filter buttons under the search box are missing (test data).

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, filtersButton, filtersMenu, openBoard, openFiltersMenu, recentSpaces, SCRUM } from "../lib/b3-jboards";

const LESSON_FILTERS = ["Assigned to me", "Recently Updated"];

runRecipe({
  file: "AUC-1134-4",
  assetId: "AT14P9T",
  title: "AUC-1134 #4 - Quick filters menu",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, SCRUM);
    await openFiltersMenu(page);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [[filtersButton(page), filtersMenu(page), page.locator('[data-testid="filters.common.ui.list.footer.panel-toggle"]')]]);
  },

  mask: (page) => [recentSpaces(page), page.locator('[data-testid="platform-board-kit.ui.card.card"]')],

  async checks(page, c) {
    await c.check("Menu button labelled 'Quick filters', open", async () => {
      const label = (await filtersButton(page).innerText().catch(() => "")).trim();
      const open = await filtersMenu(page).isVisible().catch(() => false);
      return { pass: label === "Quick filters" && open, detail: `Button: "${label}"${label === "Custom filters" ? " (UI change: renamed)" : ""}; menu open: ${open}` };
    });

    await c.check("Menu lists Assigned to me and Recently Updated with checkboxes", async () => {
      const opts = (await page.locator('[data-testid="filters.common.ui.list.option"]').allInnerTexts()).map((t) => t.trim());
      const missing = LESSON_FILTERS.filter((f) => !opts.includes(f));
      return { pass: !missing.length, detail: `Options: ${opts.join(", ")}` };
    });

    await c.check("'Show quick filters' switch at the bottom of the menu, switched on", async () => {
      const row = (await page.locator('[data-testid="filters.common.ui.list.footer.panel-toggle"]').innerText().catch(() => "")).trim();
      const on = await page.locator('[data-testid="filters.common.ui.list.panel-toggle.panel-toggle--input"]').isChecked().catch(() => null);
      return {
        pass: row === "Show quick filters" && on === true,
        detail: `Switch: "${row}"${row === "Show custom filters" ? " (UI change: renamed)" : ""}; on: ${on}${on === false ? " (test data: off for the test account; not switched on because it saves a preference)" : ""}`,
      };
    });

    await c.check("Filter buttons Assigned to me and Recently Updated under the search box", async () => {
      const bar = page.locator('[data-testid="software-board.header.controls-bar"]').locator("xpath=..");
      const shown: string[] = [];
      for (const f of LESSON_FILTERS) {
        const n = await bar.getByRole("button", { name: f, exact: true }).count();
        if (n) shown.push(f);
      }
      return { pass: shown.length === LESSON_FILTERS.length, detail: shown.length ? `Shown: ${shown.join(", ")}` : "Not shown (they only show with the switch on)" };
    });

    await boardHeaderChecks(page, c, SCRUM, "Active sprints", false);
  },
});
