// Lesson:  AUC-384 - Collaborate on work items in Jira
//          https://community.atlassian.com/learning/lesson/collaborate-on-work-items-in-jira
// Image:   #1, section "Share work items" (the open Share pop-up is outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT128T.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT128T'
// Opens the lesson's work item ("New-hire first engagement", EO-2) in the dialog over the Employee Onboarding board
// and clicks Share. Nothing is typed or sent. People are shown with fake names. Test data: the test site has no
// outgoing mail configured, so the pop-up only shows a warning (the share form checks fail until mail is set up).

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { AUC383_SUMMARY, AUC383_WORK_ITEM, jiraPeopleTweaks } from "../lib/b2-jira";
import { hidePromos, markSharePopup, openSharePopup, shareChecks, sharePopup } from "../lib/b3-jreports";

runRecipe({
  file: "AUC-384-1",
  assetId: "AT128T",
  title: "AUC-384 #1 - Share work item pop-up",
  product: "jira",

  async navigate(page, s) {
    await openSharePopup(page, s, AUC383_WORK_ITEM, AUC383_SUMMARY);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await hidePromos(page);
    await markSharePopup(page);
    await spotlight(page, sharePopup(page), { markers: false });
  },

  // Activity, linked items and agents change over time
  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await shareChecks(page, c);
  },
});
