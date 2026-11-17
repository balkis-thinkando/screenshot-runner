// Lesson:  AUC-385 - Use basic search to find information in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-basic-search
// Image:   #3, section "Use basic search to find work items" (top bar Search box clicked; the whole dropdown is outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12DPME.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12DPME'
// All work (Basic view) with the top bar Search box clicked and nothing typed. The suggestion and the recent items
// depend on the test account's history, so they are masked; the suggestion's name is shown as a fake name.

import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { fakeSuggestionName, hideTips, jiraPeopleTweaks, openGlobalSearch, searchDialog, searchDropdownChecks } from "../lib/b2-jira";

runRecipe({
  file: "AUC-385-3",
  assetId: "AT12DPME",
  title: "AUC-385 #3 - Global search dropdown",
  product: "jira",

  async navigate(page, s) {
    await openGlobalSearch(page, s);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideTips(page);
    await jiraPeopleTweaks(page, s);
    await fakeSuggestionName(page);
    await spotlight(page, searchDialog(page), { markers: false });
  },

  // Suggestion and recent items depend on the account's history; the results behind the dropdown change too
  mask: (page) => [searchDialog(page).locator('[role="listbox"]'), page.locator("table tbody")],

  checks: (page, c) => searchDropdownChecks(page, c),
});
