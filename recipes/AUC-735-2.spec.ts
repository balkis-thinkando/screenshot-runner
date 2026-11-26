// Lesson:  AUC-735 - Automatically schedule work with plans in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-auto-schedule
// Image:   #2, section "Let's explore an example!" (auto-schedule preview: the "Previewing a total of 21
//          auto-scheduled issues" banner with Cancel and Accept changes is outlined, the timeline bars are striped)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/k1p6j6c4f8nvbi4nq1d3e4nctxfh1f3u
// Recipe:  public.screenshot_recipes where asset_id = 'k1p6j6c4f8nvbi4nq1d3e4nctxfh1f3u'
// Never auto-schedules (owner rule for this batch), so the preview is not real:
//  - Stand-in plan: "Mobile First Experience" in Timeline view (the lesson's "App Development" plan is not on the
//    test site).
//  - Display-only fake: the preview banner is drawn over the plan toolbar with the lesson's text.
// Needs test data for a real capture: a plan with dated work and dependencies, plus an owner OK to click
// auto-schedule and then Cancel. The checks cover the parts that are real (plan, Timeline, auto-schedule button).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { basicTweaks, openPlan, planHeaderChecks, planMode, planModeIs, planUi } from "../lib/b3-jreports";

/** Draws the lesson's auto-schedule preview banner over the top of the plan (display only). */
async function fakePreviewBanner(page: Page) {
  const toolbar = await page.locator('[data-testid="searchfield-container"]').boundingBox();
  const top = Math.max(56, (toolbar?.y ?? 168) - 112);
  await page.evaluate((top) => {
    const main = document.querySelector('[data-testid="page-layout.main"]')!.getBoundingClientRect();
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-fake", "auto-schedule-banner");
    d.style.cssText =
      `position:fixed;left:${main.left + 8}px;top:${top}px;width:${main.width - 40}px;z-index:600;box-sizing:border-box;` +
      "padding:16px 16px 16px 48px;border-radius:4px;background:#E9F2FF;color:#172B4D;font:14px/20px var(--ds-font-family-body, sans-serif)";
    d.innerHTML =
      '<span style="position:absolute;left:16px;top:18px;width:16px;height:16px;border-radius:50%;background:#1D7AFC;color:#fff;font:700 11px/16px sans-serif;text-align:center">i</span>' +
      '<div style="font-weight:600;font-size:16px;margin-bottom:8px">Previewing a total of 21 auto-scheduled issues</div>' +
      "<div>By accepting, your plan will be updated with these changes. You'll still need to review and save all changes in your plan to Jira.</div>" +
      '<div style="margin-top:8px;color:#0C66E4">Cancel &middot; Accept changes</div>';
    document.body.appendChild(d);
  }, top);
}

runRecipe({
  file: "AUC-735-2",
  assetId: "k1p6j6c4f8nvbi4nq1d3e4nctxfh1f3u",
  title: "AUC-735 #2 - Auto-schedule preview banner",
  product: "jira",

  async navigate(page, s) {
    await openPlan(page, s);
    await planMode(page, "Timeline");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await fakePreviewBanner(page);
    await spotlight(page, page.locator('[data-screenshot-fake="auto-schedule-banner"]'), { markers: false });
  },

  mask: (page) => [page.locator(planUi.table)],

  async checks(page, c) {
    await planHeaderChecks(page, c);

    await c.check("Timeline view selected", async () => {
      const t = await planModeIs(page, "Timeline");
      return { pass: t, detail: `Timeline selected: ${t}` };
    });

    await c.check("Auto-schedule button available (the lesson's preview starts there)", async () => {
      const b = page.locator(planUi.autoSchedule);
      const label = (await b.getAttribute("aria-label")) || (await b.getAttribute("title")) || "Auto-schedule (by test id)";
      const enabled = await b.isEnabled();
      return { pass: /auto-?schedule/i.test(label) && enabled, detail: `Label: "${label}"; enabled: ${enabled}` };
    });
  },
});
