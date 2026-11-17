// Lesson:  AUC-383 - Update work items in Jira
//          https://community.atlassian.com/learning/lesson/edit-issue-in-jira
// Image:   #9, section "Delete work" (More actions menu open and outlined, arrow on Delete)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT129G.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT129G'
// Opens the lesson's work item (AUC383_WORK_ITEM) and its More actions (...) menu at the top right, and outlines the
// menu. Delete is never clicked. The lesson also shows an attachment behind the menu; this work item has none, which
// the menu step does not need.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlight } from "../lib/tweaks";
import {
  actionsButton, AUC383_SUMMARY, AUC383_WORK_ITEM, havePermissions, hideTips, jiraPeopleTweaks, LESSON_MORE_ACTIONS, menuItems, openMenu, openWorkItem,
} from "../lib/b2-jira";

const target = (page: Page) => openMenu(page).getByRole("menuitem", { name: /^Delete$/ });

runRecipe({
  file: "AUC-383-9",
  assetId: "AT129G",
  title: "AUC-383 #9 - More actions menu, Delete",
  product: "jira",

  async navigate(page, s) {
    await openWorkItem(page, s, AUC383_WORK_ITEM, AUC383_SUMMARY);
    await actionsButton(page).click();
    await openMenu(page).getByRole("menuitem").first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideTips(page);
    await jiraPeopleTweaks(page, s);
    await spotlight(page, openMenu(page), { markers: false });
    // The lesson's arrow points at Delete
    if (await target(page).isVisible().catch(() => false)) await markers(page, target(page), "left", [80]);
  },

  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await c.check("More actions menu open from the ... button at the top right", async () => {
      const open = await openMenu(page).isVisible();
      const expanded = await actionsButton(page).getAttribute("aria-expanded");
      return { pass: open && expanded === "true", detail: `Menu open: ${open}; button expanded: ${expanded}` };
    });

    await c.check("'Delete' item in the menu", async () => {
      const shown = await target(page).isVisible().catch(() => false);
      if (shown) return { pass: true, detail: "Present" };
      const perm = await havePermissions(page, AUC383_WORK_ITEM.split("-")[0], ["DELETE_ISSUES"]);
      return {
        pass: false,
        detail: perm.DELETE_ISSUES === false
          ? "Missing: test data, the test account has no DELETE_ISSUES permission in this space"
          : "Missing although the account has the permission: UI change",
      };
    });

    await c.check("Menu items as in the lesson (Log work, Add flag, Watch, Add vote, Select cover, Clone, Move, Archive, Delete...)", async () => {
      const items = await menuItems(page);
      const missing = LESSON_MORE_ACTIONS.filter((t) => !items.includes(t));
      // Archive and Delete only show with the matching permission: tell test data apart from a UI change
      const perm = await havePermissions(page, AUC383_WORK_ITEM.split("-")[0], ["ARCHIVE_ISSUES", "DELETE_ISSUES"]);
      const noPerm = missing.filter((m) => (m === "Archive" && perm.ARCHIVE_ISSUES === false) || (m === "Delete" && perm.DELETE_ISSUES === false));
      const ui = missing.filter((m) => !noPerm.includes(m));
      return {
        pass: !missing.length,
        detail: `${ui.length ? `UI change, missing: ${ui.join(", ")}; ` : ""}${noPerm.length ? `test data (no permission): ${noPerm.join(", ")}; ` : ""}menu: ${items.join(", ")}`,
      };
    });

    await c.check("Work item title and status button behind the menu", async () => {
      const title = await page.getByRole("heading", { name: AUC383_SUMMARY }).first().isVisible();
      const status = await page.locator('[data-testid="issue-field-status.ui.status-view.status-button.status-button"]').first().isVisible();
      return { pass: title && status, detail: `Title: ${title}; status: ${status}` };
    });
  },
});
