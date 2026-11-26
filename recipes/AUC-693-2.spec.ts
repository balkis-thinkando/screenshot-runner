// Lesson:  AUC-693 - Customize card layouts for a Jira board
//          https://community.atlassian.com/learning/lesson/jira-customize-card-layout
// Image:   #2, section "Compare card layout and the layout for work items" (full work item view; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT11VP.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT11VP'
// Opens the lesson's work item "Notification update to base url" in the full-page view. On the test site it is
// PLAT-9 (parent PLAT-1 "Notifications"); the lesson's site numbers it PLAT-33521 (parent PLAT-8 "Analytics").
// It has no description on the test site (the lesson's has two sentences). People are shown with fake names.

import { test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { itemHeading, jiraPeopleTweaks, openWorkItem } from "../lib/b2-jira";
import { hidePromos, protectFieldLabels, SHARE_BUTTON, WATCHERS_BUTTON } from "../lib/b3-jreports";

const KEY = "PLAT-9";
const SUMMARY = "Notification update to base url";

runRecipe({
  file: "AUC-693-2",
  assetId: "AT11VP",
  title: "AUC-693 #2 - Work item view with details",
  product: "jira",

  async navigate(page, s) {
    test.setTimeout(240_000);
    await openWorkItem(page, s, KEY, SUMMARY);
    page.setDefaultTimeout(15_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await protectFieldLabels(page);
    await jiraPeopleTweaks(page, s);
    await hidePromos(page);
  },

  // Activity changes over time
  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await c.check("Breadcrumb Platform Development / parent / work item, and the title", async () => {
      const crumbs = (await page.locator('[data-testid^="issue.views.issue-base.foundation.breadcrumbs"]').allInnerTexts()).join(" / ").replace(/\s+/g, " ");
      const title = (await itemHeading(page).innerText()).trim();
      const ok = /Platform Development/.test(crumbs) && /PLAT-1\b/.test(crumbs) && /PLAT-9\b/.test(crumbs) && title === SUMMARY;
      return { pass: ok, detail: `Breadcrumb: ${crumbs.slice(0, 80)}; title: "${title}"` };
    });

    await c.check("Status button (In Progress), watchers button and Share button", async () => {
      const status = (await page.locator('[data-testid="issue-field-status.ui.status-view.status-button.status-button"]').first().innerText().catch(() => "")).trim();
      const watch = await page.locator(WATCHERS_BUTTON).first().isVisible();
      const share = await page.locator(SHARE_BUTTON).first().isVisible();
      return { pass: !!status && watch && share, detail: `Status: "${status}" (lesson: In Progress); watchers: ${watch}; share: ${share}` };
    });

    await c.check("Description section", async () => {
      const h = await page.locator('[data-testid="issue-view-base.common.description.heading-wrapper"], [data-testid="issue.views.issue-base.common.description.label"]').first().isVisible();
      return { pass: h, detail: h ? "Present (empty on the test site)" : "Missing" };
    });

    await c.check("Details panel fields: Assignee, Reporter, Parent, Story Points, Sprint, Original estimate, Time tracking", async () => {
      const text = await page.locator('[data-testid="issue.views.issue-details.issue-layout.container-right"]').innerText().catch(async () => page.locator("body").innerText());
      const missing = ["Assignee", "Reporter", "Parent", "Story Points", "Sprint", "Original estimate", "Time tracking"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Details panel has Details and Automation tabs", async () => {
      const text = await page.locator('[data-testid="issue.views.issue-details.issue-layout.container-right"]').innerText().catch(() => "");
      const auto = /\bAutomation\b/.test(text);
      return { pass: /\bDetails\b/.test(text) && auto, detail: auto ? "Present" : "UI change: Details is a collapsible section; no Automation tab next to it" };
    });

    await c.check("Agents section and Activity section", async () => {
      const text = await page.locator('[data-testid="issue.views.issue-details.issue-layout.container-left"]').innerText().catch(() => "");
      const agents = /\bAgents\b/.test(text);
      const act = await page.locator('[data-testid="issue-activity-feed.heading"]').isVisible();
      return { pass: agents && act, detail: `Agents section: ${agents ? "present" : "missing (now 'Agent sessions')"}; Activity: ${act}` };
    });
  },
});
