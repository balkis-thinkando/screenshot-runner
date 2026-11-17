// Lesson:  AUC-383 - Update work items in Jira
//          https://community.atlassian.com/learning/lesson/edit-issue-in-jira
// Image:   #1, section "Add attachments to work items" (the attach / link / child work item buttons under the
//          description are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT128J.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT128J'
// Opens the lesson's own work item (AUC383_WORK_ITEM, "New-hire first engagement", which has a linked work item) and
// outlines the quick-add buttons under the title. Nothing is clicked. People are shown with fake names.

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { AUC383_SUMMARY, AUC383_WORK_ITEM, itemHeading, jiraPeopleTweaks, openWorkItem, quickAddButton, quickAddRow } from "../lib/b2-jira";

runRecipe({
  file: "AUC-383-1",
  assetId: "AT128J",
  title: "AUC-383 #1 - Work item with attach, link and child buttons",
  product: "jira",

  async navigate(page, s) {
    await openWorkItem(page, s, AUC383_WORK_ITEM, AUC383_SUMMARY);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await spotlight(page, quickAddRow(page), { markers: false });
  },

  // Activity and dates change over time
  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await c.check("Work item view: breadcrumb Employee Onboarding / EO-1 / EO-2 and the title", async () => {
      const crumbs = (await page.locator('[data-testid^="issue.views.issue-base.foundation.breadcrumbs"]').allInnerTexts()).join(" / ");
      const title = (await itemHeading(page).innerText()).trim();
      const ok = /Employee Onboarding/.test(crumbs) && /EO-2/.test(crumbs) && title === AUC383_SUMMARY;
      return { pass: ok, detail: `Breadcrumb: ${crumbs.replace(/\s+/g, " ").slice(0, 80)}; title: "${title}"` };
    });

    await c.check("Attach, Link and Child work item icon buttons under the description", async () => {
      // The lesson shows three icon buttons (attachment, link, child). Since 2026 there is one "+" button
      // ("Add or create work related to this ...") whose menu holds these actions.
      const icons = await page.getByRole("button", { name: /^(Attach|Add attachment|Link (work item|issue)|Add a child|Create child)/ }).count();
      const plus = await quickAddButton(page).isVisible();
      return {
        pass: icons >= 3,
        detail: icons >= 3 ? "Present" : `UI change: the three icon buttons are gone; ${plus ? "a single '+' (Add or create) button under the title holds them" : "no quick-add button found"}`,
      };
    });

    await c.check("Description section", async () => {
      const h = await page.locator('[data-testid="issue.views.issue-base.common.description.label"]').isVisible();
      return { pass: h, detail: h ? "Present" : "Missing" };
    });

    await c.check("Linked work items section with at least one linked item", async () => {
      const toggle = await page.locator('[data-testid="issue.views.common.collapsible-section.LINKED_WORK_ITEM.toggle"]').isVisible();
      const rows = await page.locator('[data-testid="issue.issue-view.views.common.issue-line-card.issue-line-card-view.key"]').count();
      return { pass: toggle && rows > 0, detail: `Section: ${toggle}; linked items: ${rows}` };
    });

    await c.check("Details panel: Assignee, Reporter, Priority, Labels, Due date, Start date", async () => {
      const text = await page.locator("body").innerText();
      const missing = ["Assignee", "Reporter", "Priority", "Labels", "Due date", "Start date"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Status button and Activity section", async () => {
      const status = await page.locator('[data-testid="issue-field-status.ui.status-view.status-button.status-button"]').first().isVisible();
      const act = await page.locator('[data-testid="issue-activity-feed.heading"]').isVisible();
      return { pass: status && act, detail: `Status: ${status}; Activity: ${act}` };
    });
  },
});
