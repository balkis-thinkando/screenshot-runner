// Lesson:  AUC-1695 - Use swimlanes to group work on a company-managed Jira board
//          https://community.atlassian.com/learning/lesson/use-jira-board-swimlanes
// Image:   #1, section "Use swimlanes to group work for better visibility" (MP kanban board grouped into one swimlane
//          per assignee; the swimlanes are outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT11Z5.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT11Z5'
// Opens MP board (Mobile Program), the lesson's board, with its Group menu open and outlined.
// Test data: no kanban board on the site is grouped by assignee (MP board is grouped by Query). Picking Assignee in
// the Group menu saves the board's swimlane setting, so it is never clicked; the menu only shows that the option is
// there, and the "grouped by assignee" check fails until a board is set up that way (owner's OK needed).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, groupButton, KANBAN, openBoard, recentSpaces, swimlanes } from "../lib/b3-jboards";

const groupItems = (page: Page) => page.locator('[data-testid="software-board.header.controls-bar.swimlane-switch.dropdown-item"]');

runRecipe({
  file: "AUC-1695-1",
  assetId: "AT11Z5",
  title: "AUC-1695 #1 - Swimlanes grouped by assignee",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, KANBAN);
    await groupButton(page).click();
    await groupItems(page).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    // The lesson outlines the swimlanes; until a board is grouped by assignee, the Group menu (where that is set) is
    // outlined instead (two overlapping outlines would undo each other's dimming)
    await spotlightAreas(page, [[groupButton(page), groupItems(page).first(), groupItems(page).last()]]);
  },

  mask: (page) => [recentSpaces(page), page.locator('[data-testid="platform-board-kit.ui.card.card"]')],

  async checks(page, c) {
    await c.check("Group menu offers Assignee", async () => {
      const items = (await groupItems(page).allInnerTexts()).map((t) => t.trim());
      return { pass: items.includes("Assignee"), detail: `Group menu: ${items.join(", ")}` };
    });

    await c.check("Board grouped by assignee: one swimlane per person with '(N work items)'", async () => {
      const label = (await groupButton(page).innerText().catch(() => "")).split("\n")[0].trim();
      const lanes = await swimlanes(page).count();
      const byAssignee = /Assignee/i.test(label);
      return {
        pass: byAssignee && lanes > 0,
        detail: byAssignee
          ? `${lanes} swimlanes`
          : `Test data: the board is grouped by "${label.replace(/^Group:?\s*/, "") || "nothing"}" (${lanes} swimlanes); no kanban board on the site is grouped by assignee`,
      };
    });

    await c.check("Columns in each swimlane: Backlog, Selected for Development, In Progress, Done", async () => {
      const text = (await swimlanes(page).first().innerText().catch(() => "")).toUpperCase();
      const missing = ["BACKLOG", "SELECTED FOR DEVELOPMENT", "IN PROGRESS", "DONE"].filter((x) => !text.includes(x));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await boardHeaderChecks(page, c, KANBAN, "Kanban board", true);
  },
});
