// Lesson:  AUC-671 - Configure SLAs to manage service quality goals
//          https://community.atlassian.com/learning/lesson/master-jira-service-management-sla-configuration
// Image:   #2, section "Group SLA goals to increase your overall goal capacity" (IT Support SLAs, Time to resolution being edited: a goal for Ticket category = Service requests with priority rows High, Medium, Low, All remaining priorities, calendar and time target; the goal outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/13t51333i47d1ka8c2l4f8q084g7ua11
// Recipe:  public.screenshot_recipes where asset_id = '13t51333i47d1ka8c2l4f8q084g7ua11'
// Opens IT Support (ITS) space settings > SLAs, clicks Edit on Time to resolution and scrolls to its goals. The edit
// form is left without saving. Test data: ITS goals may not be grouped by priority.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const goal = (page: Page) => page.getByText("And priority is:").first().locator("xpath=ancestor::*[.//*[contains(., 'All remaining priorities')]][1]");

runRecipe({
  file: "AUC-671-2",
  assetId: "13t51333i47d1ka8c2l4f8q084g7ua11",
  title: "AUC-671 #2 - SLA goals by priority",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/servicedesk/projects/ITS/settings/sla", (p) => p.getByText("Time to resolution"));
    // Edit on the Time to resolution metric (the first one); nothing is saved
    const row = page.getByText("Time to resolution", { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space()='Edit']][1]");
    await row.getByRole("button", { name: "Edit" }).first().click();
    await page.getByText("Goals", { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    // Scroll the goals to the top of the page, as in the lesson
    const target = (await goal(page).isVisible().catch(() => false)) ? goal(page) : page.getByText("Apply to work items").first();
    await target.evaluate((e) => e.scrollIntoView({ block: "start" }));
    await settle(page);
  },

  async tweak(page, s) {
    await jsmTweaks(page, s);
    // The lesson's goal (Service requests, grouped by priority), or the ITS Service requests goal when not grouped
    const serviceGoal = page.getByText('"Service requests"').first().locator("xpath=ancestor::*[.//*[contains(., 'Add priority')]][1]");
    await outline(page, (await goal(page).isVisible().catch(() => false)) ? goal(page) : serviceGoal);
  },

  async checks(page, c) {
    await checkTexts(c, "Goals: 'Apply to work items', 'Calendar', 'Time target'", page, ["Goals", "Apply to work items", "Calendar", "Time target"], mainArea(page));
    await c.check("A goal grouped by priority ('And priority is:' High, Medium, Low, All remaining priorities)", async () => {
      const v = await goal(page).isVisible().catch(() => false);
      const text = v ? await textOf(goal(page)) : "";
      const missing = ["High", "Medium", "Low", "All remaining priorities"].filter((t) => !text.includes(t));
      return { pass: v && !missing.length, detail: v ? (missing.length ? `Missing: ${missing.join(", ")}` : "All present") : "Needs test data: no ITS Time to resolution goal is grouped by priority" };
    });
    await checkTexts(c, "JQL goal condition and '+ Add priority'", page, ["Add priority"], mainArea(page));
    await checkTexts(c, "Space settings sidebar: Request management, Forms, Workflows, SLAs, Customer satisfaction", page, ["Request management", "Forms", "Workflows", "SLAs", "Customer satisfaction"]);
  },
});
