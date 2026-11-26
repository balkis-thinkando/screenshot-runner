// Lesson:  AUC-384 - Collaborate on work items in Jira
//          https://community.atlassian.com/learning/lesson/collaborate-on-work-items-in-jira
// Image:   #2, section "Share work items" (same Share pop-up as #1; the Copy link button is outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT128G.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT128G'
// Opens the lesson's work item (EO-2, "New-hire first engagement") over the Employee Onboarding board and clicks
// Share. Copy link is not clicked. Test data: the test site has no outgoing mail configured, so the pop-up only shows
// a warning and has no Copy link button; the whole pop-up is outlined then.

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { AUC383_SUMMARY, AUC383_WORK_ITEM, jiraPeopleTweaks } from "../lib/b2-jira";
import { hidePromos, markSharePopup, openSharePopup, shareChecks, sharePopup } from "../lib/b3-jreports";

runRecipe({
  file: "AUC-384-2",
  assetId: "AT128G",
  title: "AUC-384 #2 - Share pop-up, Copy link",
  product: "jira",

  async navigate(page, s) {
    await openSharePopup(page, s, AUC383_WORK_ITEM, AUC383_SUMMARY);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await hidePromos(page);
    await markSharePopup(page);
    const copy = sharePopup(page).getByText("Copy link", { exact: true }).first();
    await spotlight(page, (await copy.isVisible().catch(() => false)) ? copy : sharePopup(page), { markers: false });
  },

  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await shareChecks(page, c);
  },
});
