// Lesson:  AUC-734 - Create plans in Jira
//          https://community.atlassian.com/learning/lesson/how-to-create-a-plan-in-jira
// Image:   #2, section "Add data to plans" (plan List view; MOBL-5's More actions menu with the Create submenu open)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12E1HZ.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12E1HZ'
// Test data: the lesson's plan "Mobile First Experience" (plan 3 on the test site). Opens it in List view, clicks
// More actions on MOBL-5 and hovers Create. No item is clicked. The "Welcome to Plans" pop-up is hidden.

import { runRecipe } from "../lib/recipe";
import { basicTweaks, openPlan, planHeaderChecks, planMode, planRow, planUi, rowMoreButton } from "../lib/b3-jreports";

const KEY = "MOBL-5";
const CREATE_TRIGGER = '[data-testid="portfolio-3-portfolio.app-simple-plans.main.tabs.roadmap.scope.issues.issue.drop-menu.create-issue-type.drop-menu--trigger"]';
const LESSON_MENU = ["Create", "Move", "Select", "Remove from plan"];
const LESSON_SUBMENU = ["Create Epic", "Create Bug", "Create Feature request", "Create Story", "Create Task"];

runRecipe({
  file: "AUC-734-2",
  assetId: "AT12E1HZ",
  title: "AUC-734 #2 - Plan row More actions, Create submenu",
  product: "jira",

  async navigate(page, s) {
    await openPlan(page, s);
    await planMode(page, "List");
    await planRow(page, KEY).hover();
    await rowMoreButton(page, KEY).click();
    // "Create" opens a submenu (it creates nothing by itself); hovering alone does not open it
    const create = page.locator(CREATE_TRIGGER).first();
    await create.waitFor({ timeout: 15_000 });
    await create.hover();
    await page.waitForTimeout(800);
    const sub = page.locator('[role="menuitem"]:visible').filter({ hasText: /^Create Epic/ }).first();
    if (!(await sub.isVisible().catch(() => false))) await create.click();
    await sub.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
  },

  mask: (page) => [page.locator(planUi.table)],

  async checks(page, c) {
    await planHeaderChecks(page, c);

    await c.check("Row menu: Create, Move, Select, Remove from plan", async () => {
      const items = (await page.locator('[role="menuitem"]:visible').allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const missing = LESSON_MENU.filter((m) => !items.includes(m));
      return { pass: !missing.length, detail: `Items: ${items.filter((i) => !/^Create ./.test(i)).join(", ")}` };
    });

    await c.check("Create submenu: Create Epic, Bug, Feature request, Story, Task, and Suggest child work items", async () => {
      const items = (await page.locator('[role="menuitem"]:visible').allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const missing = LESSON_SUBMENU.filter((m) => !items.includes(m));
      const suggest = items.some((i) => /^Suggest child work items/.test(i));
      const sub = items.filter((i) => /^Create ./.test(i));
      return {
        pass: !missing.length && suggest,
        detail: `Submenu: ${sub.join(", ")}${missing.length ? ` (missing: ${missing.join(", ")})` : ""}; Suggest child work items: ${suggest ? "present (UI change: now in the row menu, not the Create submenu)" : "missing"}`,
      };
    });
  },
});
