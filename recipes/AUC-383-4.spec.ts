// Lesson:  AUC-383 - Update work items in Jira
//          https://community.atlassian.com/learning/lesson/edit-issue-in-jira
// Image:   #4, section "Link work items" (the attach / link / child buttons outlined, the arrow on the link button)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12A6.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12A6'
// Opens the lesson's work item (AUC383_WORK_ITEM) and opens the "+" (Add or create) menu under the title, which now
// holds "Link work item"; that item is outlined. Only the menu is opened: no link is created.

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { AUC383_SUMMARY, AUC383_WORK_ITEM, hideTips, jiraPeopleTweaks, menuItems, openMenu, openWorkItem, quickAddButton } from "../lib/b2-jira";

const linkItem = (page: import("@playwright/test").Page) =>
  page.locator('[data-testid="issue.issue-view.views.issue-base.foundation.quick-add.quick-add-item.link-issue"]');

runRecipe({
  file: "AUC-383-4",
  assetId: "AT12A6",
  title: "AUC-383 #4 - Link work item button",
  product: "jira",

  async navigate(page, s) {
    await openWorkItem(page, s, AUC383_WORK_ITEM, AUC383_SUMMARY);
    await quickAddButton(page).click();
    await linkItem(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideTips(page);
    await jiraPeopleTweaks(page, s);
    await spotlight(page, linkItem(page), { markers: false });
  },

  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await c.check("Link work item button under the description (lesson: icon button)", async () => {
      const icon = await page.getByRole("button", { name: /^Link (work item|issue)/ }).first().isVisible().catch(() => false);
      const inMenu = await linkItem(page).isVisible();
      return {
        pass: icon,
        detail: icon ? "Present" : `UI change: no link icon button; "Link work item" is ${inMenu ? "an item of the '+' (Add or create) menu" : "missing"}`,
      };
    });

    await c.check("Menu offers Link work item, Add attachment and Create subtask/child", async () => {
      const items = await menuItems(page);
      const missing = ["Link work item", "Add attachment"].filter((t) => !items.some((i) => i.startsWith(t)));
      const child = items.some((i) => /^Create (subtask|child)/.test(i));
      return { pass: !missing.length && child, detail: `Menu: ${items.join(", ")}` };
    });

    await c.check("Linked work items section with at least one linked item", async () => {
      const rows = await page.locator('[data-testid="issue.issue-view.views.common.issue-line-card.issue-line-card-view.key"]').count();
      return { pass: rows > 0, detail: `Linked items: ${rows}` };
    });

    await c.check("Menu is open next to the '+' button", async () => {
      const open = await openMenu(page).isVisible();
      return { pass: open, detail: open ? "Open" : "Closed" };
    });
  },
});
