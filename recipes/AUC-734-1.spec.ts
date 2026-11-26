// Lesson:  AUC-734 - Create plans in Jira
//          https://community.atlassian.com/learning/lesson/how-to-create-a-plan-in-jira
// Image:   #1, section "Add data to plans" (plan List view; the Create work button and the Create work item dialog
//          with the Work type list open are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14P9G.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14P9G'
// Test data: the lesson's plan "Mobile First Experience" (plan 3 on the test site). Opens it in List view, clicks
// Create work, picks the Mobile Dev space and opens the Work type list. Create is never clicked, so nothing is added
// to the plan. The "Welcome to Plans" pop-up is hidden (display only, not dismissed).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { basicTweaks, openPlan, pickOption, planHeaderChecks, planMode, planModeIs, planUi, selectControls } from "../lib/b3-jreports";

const dialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: "Create work item" }).last();
const list = (page: Page) => page.locator('[role="listbox"]:visible').last();
const LESSON_TYPES = ["Epic", "Bug", "Feature request", "Story", "Task", "Sub-task"];

runRecipe({
  file: "AUC-734-1",
  assetId: "AT14P9G",
  title: "AUC-734 #1 - Plan Create work item dialog",
  product: "jira",

  async navigate(page, s) {
    await openPlan(page, s);
    await planMode(page, "List");
    await page.locator(planUi.createWork).click();
    await dialog(page).waitFor({ timeout: 20_000 });
    await pickOption(page, selectControls(dialog(page)).nth(0), /^Mobile Dev$/);
    await selectControls(dialog(page)).nth(1).click();
    await list(page).locator('[role="option"]').first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await spotlightAreas(page, [page.locator(planUi.createWork), [dialog(page), list(page)]]);
  },

  // Dates and statuses of the plan's work change over time
  mask: (page) => [page.locator(planUi.table)],

  async checks(page, c) {
    await planHeaderChecks(page, c);

    await c.check("List view with Work item, Create work and Add Fields headers", async () => {
      const list = await planModeIs(page, "List");
      const text = await page.locator(planUi.table).innerText();
      const ok = list && text.includes("Create work") && text.includes("Add Fields");
      return { pass: ok, detail: `List selected: ${list}; Create work: ${text.includes("Create work")}; Add Fields: ${text.includes("Add Fields")}` };
    });

    await c.check("Dialog 'Create work item' with Space (Mobile Dev) and Work type fields", async () => {
      const text = await dialog(page).innerText();
      const ok = text.includes("Create work item") && /Space\s*\*/.test(text) && /Work type\s*\*/.test(text) && text.includes("Mobile Dev");
      return { pass: ok, detail: ok ? "Present" : `Dialog: ${text.replace(/\s+/g, " ").slice(0, 100)}` };
    });

    await c.check("Work type list: Epic, Bug, Feature request, Story, Task, Sub-task", async () => {
      const opts = (await list(page).locator('[role="option"]').allInnerTexts()).map((t) => t.trim());
      const missing = LESSON_TYPES.filter((t) => !opts.includes(t));
      return { pass: !missing.length, detail: `${missing.length ? "Test data: Mobile Dev's work types differ; " : ""}Options: ${opts.join(", ")}` };
    });
  },
});
