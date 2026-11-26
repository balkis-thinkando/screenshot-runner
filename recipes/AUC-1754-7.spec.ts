// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #7, section "Configure dependencies" (work item view; the Linked work items section with two
//          "is blocked by" links is outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14FMW.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14FMW'
// Stand-in work item: the lesson's EO-2 only "blocks" one item on the test site. MC-39 (Marketing Content, a business
// space like the lesson's) "is blocked by" two work items (MC-34, MC-26) and has no other links. Opened in the
// full-page view and scrolled so the section is in the middle; nothing is edited. People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { jiraPeopleTweaks, openWorkItem } from "../lib/b2-jira";
import { fakeSpacePeople, MC39 } from "../lib/b3-jsearch";

const heading = (page: Page) => page.getByRole("heading", { name: "Linked work items" }).first();
// The section: the closest block around the heading that also holds the linked items
const linked = (page: Page) => heading(page).locator(`xpath=ancestor::*[contains(., "${MC39.blockedBy[1]}")][1]`);

runRecipe({
  file: "AUC-1754-7",
  assetId: "AT14FMW",
  title: "AUC-1754 #7 - Linked work items",
  product: "jira",

  async navigate(page, s) {
    await openWorkItem(page, s, MC39.key, MC39.summary);
    await heading(page).waitFor({ timeout: 30_000 });
    await page.getByText(MC39.blockedBy[1]).first().waitFor({ timeout: 30_000 });
    await heading(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await fakeSpacePeople(page, s, ["MC"]);
    await spotlight(page, linked(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Work item view: title and breadcrumb Spaces / Marketing Content / MC-39", async () => {
      const h = await page.getByRole("heading", { name: MC39.summary }).first().isVisible().catch(() => false);
      const crumbs = await page.locator('[data-testid="issue.views.issue-base.foundation.breadcrumbs.item"]').first()
        .locator(`xpath=ancestor::*[contains(., "${MC39.key}")][1]`).innerText({ timeout: 5_000 }).catch(() => "");
      return { pass: h && /MC-39/.test(crumbs), detail: `Title: ${h}; breadcrumb: "${crumbs.replace(/\s+/g, " ").trim().slice(0, 100)}"` };
    });

    await c.check("Linked work items section with an add (+) button", async () => {
      const sec = await heading(page).isVisible().catch(() => false);
      const add = await linked(page).getByRole("button").last().isVisible().catch(() => false);
      return { pass: sec && add, detail: `Section: ${sec}; add button: ${add}` };
    });

    await c.check("Two linked items 'is blocked by': MC-34 and MC-26", async () => {
      const text = await linked(page).innerText({ timeout: 5_000 }).catch(() => "");
      const group = /is blocked by/.test(text);
      const keys = MC39.blockedBy.filter((k) => text.includes(k));
      return { pass: group && keys.length === 2, detail: `"is blocked by": ${group}; items: ${keys.join(", ")}` };
    });

    await c.check("Links shown as a table with Relationship, Work, Priority columns", async () => {
      const text = await linked(page).innerText({ timeout: 5_000 }).catch(() => "");
      const missing = ["Relationship", "Work", "Priority"].filter((t) => !new RegExp(`(^|\\n)${t}(\\n|$)`).test(text));
      return {
        pass: !missing.length,
        detail: missing.length ? "UI change: links are grouped under a relationship heading ('is blocked by'), each row with status, assignee and priority; no table header" : "Table header present",
      };
    });

    await c.check("Details panel: Assignee, Reporter, Start date, Due date", async () => {
      const all = await page.locator("body").innerText();
      const missing = ["Assignee", "Reporter", "Start date", "Due date"].filter((t) => !all.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
