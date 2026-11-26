// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #1, section "View and schedule your work in Jira" (Employee Onboarding Timeline, Months, one epic
//          expanded, bars linked by dependency lines)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14MKR.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14MKR'
// Stand-in space: the lesson's Employee Onboarding items are dated 2024 and 2025, before the earliest month the
// Timeline shows, so this uses M0018 - Museum Communication (MMC), whose items are dated March to July 2027 with
// "blocks" dependencies. Both epics are expanded (no change on the site) and the chart is scrolled to February
// 2027. Sidebar hidden, display only, as in the lesson. People are shown with fake names.

import { runRecipe } from "../lib/recipe";
import { fakeSpacePeople, MMC, openMmcTimeline, tabsCheck, timelineChecks } from "../lib/b3-jsearch";

runRecipe({
  file: "AUC-1754-1",
  assetId: "AT14MKR",
  title: "AUC-1754 #1 - Timeline with dependencies",
  product: "jira",

  async navigate(page, s) {
    await openMmcTimeline(page, s);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, [MMC.key]);
  },

  async checks(page, c) {
    await tabsCheck(page, c, "Timeline", ["Summary", "Board", "List", "Calendar", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports"]);
    await timelineChecks(page, c);
  },
});
