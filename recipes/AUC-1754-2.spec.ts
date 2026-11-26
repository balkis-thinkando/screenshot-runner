// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #2, section "View and schedule your work in Jira" (Employee Onboarding Calendar, a month with work items)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14FN9.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14FN9'
// Stand-in space (see AUC-1754-1): the M0018 - Museum Communication (MMC) Calendar on March 2027, the month of its
// work items, opened by its address (nothing saved). The Unscheduled work panel is closed, as in the lesson (a view
// toggle). Sidebar hidden, display only. People are shown with fake names.

import { runRecipe } from "../lib/recipe";
import { calendarChecks, calendarMonth, fakeSpacePeople, MMC, openMmcCalendar, tabsCheck } from "../lib/b3-jsearch";

runRecipe({
  file: "AUC-1754-2",
  assetId: "AT14FN9",
  title: "AUC-1754 #2 - Calendar view",
  product: "jira",

  async navigate(page, s) {
    await openMmcCalendar(page, s, false);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, [MMC.key]);
  },

  async checks(page, c) {
    await tabsCheck(page, c, "Calendar", ["Summary", "Board", "List", "Calendar", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports"]);
    await calendarChecks(page, c);
    await c.check("Month 'Mar 2027' shown, Unscheduled work panel closed", async () => {
      const m = await calendarMonth(page);
      const panel = await page.getByRole("heading", { name: "Unscheduled work" }).isVisible().catch(() => false);
      return { pass: m === "Mar 2027" && !panel, detail: `Month: "${m}"; panel open: ${panel}` };
    });
  },
});
