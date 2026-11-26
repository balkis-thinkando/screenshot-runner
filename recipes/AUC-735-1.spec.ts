// Lesson:  AUC-735 - Automatically schedule work with plans in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-auto-schedule
// Image:   #1, section "Use plans to schedule your work" (plan Timeline; the auto-schedule button is outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/aq7y76fre76jv1lsd1681y63f15n7s50
// Recipe:  public.screenshot_recipes where asset_id = 'aq7y76fre76jv1lsd1681y63f15n7s50'
// Stand-in: the lesson's "App Development" plan (TA work items) is not on the test site; the recipe uses the
// "Mobile First Experience" plan instead (needs test data for the exact screen: a plan with dated, dependent work).
// Opens it in Timeline view and outlines the auto-schedule button. Auto-schedule is never clicked.

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { basicTweaks, openPlan, planHeaderChecks, planMode, planModeIs, planUi } from "../lib/b3-jreports";

runRecipe({
  file: "AUC-735-1",
  assetId: "aq7y76fre76jv1lsd1681y63f15n7s50",
  title: "AUC-735 #1 - Plan auto-schedule button",
  product: "jira",

  async navigate(page, s) {
    await openPlan(page, s);
    await planMode(page, "Timeline");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await spotlight(page, page.locator(planUi.autoSchedule), { markers: false });
  },

  // The timeline moves with today's date; rows and statuses change
  mask: (page) => [page.locator(planUi.table)],

  async checks(page, c) {
    await planHeaderChecks(page, c);

    await c.check("Timeline view selected", async () => {
      const t = await planModeIs(page, "Timeline");
      return { pass: t, detail: `Timeline selected: ${t}` };
    });

    await c.check("Auto-schedule button (calendar icon) next to the Timeline / List toggle", async () => {
      const b = page.locator(planUi.autoSchedule);
      const label = (await b.getAttribute("aria-label")) || (await b.getAttribute("title")) || "Auto-schedule (by test id)";
      const box = await b.boundingBox();
      const toggle = await page.locator(planUi.listToggle).boundingBox();
      const near = !!box && !!toggle && box.x > toggle.x && box.x - (toggle.x + toggle.width) < 40;
      return { pass: /auto-?schedule/i.test(label) && near, detail: `Label: "${label}"; right of the toggle: ${near}` };
    });

    await c.check("Timeline columns: Work item, Fields, month headers", async () => {
      const text = await page.locator(planUi.table).innerText();
      const months = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(text);
      const ok = text.includes("Work item") && text.includes("Fields") && months;
      return { pass: ok, detail: `Work item: ${text.includes("Work item")}; Fields: ${text.includes("Fields")}; months: ${months}` };
    });

    await c.check("Work items in the plan (lesson: epics with child stories)", async () => {
      const n = await page.locator(planUi.rows).count();
      return { pass: n > 3, detail: `Rows: ${n}` };
    });
  },
});
