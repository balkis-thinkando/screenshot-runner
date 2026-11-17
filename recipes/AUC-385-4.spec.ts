// Lesson:  AUC-385 - Use basic search to find information in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-basic-search
// Image:   #4, section "Use the search bar" (top bar Search box clicked; the dropdown is outlined, an arrow points at the quick filter buttons)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT11XV.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT11XV'
// All work (Basic view) with the top bar Search box clicked and nothing typed. The suggestion and the recent items
// depend on the test account's history, so they are masked; the suggestion's name is shown as a fake name.

import { runRecipe } from "../lib/recipe";
import { markers, spotlight } from "../lib/tweaks";
import { fakeSuggestionName, hideTips, jiraPeopleTweaks, openGlobalSearch, QUICK_FILTERS, quickFilter, searchDialog, searchDropdownChecks } from "../lib/b2-jira";

runRecipe({
  file: "AUC-385-4",
  assetId: "AT11XV",
  title: "AUC-385 #4 - Search dropdown quick filters",
  product: "jira",

  async navigate(page, s) {
    await openGlobalSearch(page, s);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideTips(page);
    await jiraPeopleTweaks(page, s);
    await fakeSuggestionName(page);
    // The lesson outlines the dropdown and points an arrow at the quick filters (a marker here)
    await spotlight(page, searchDialog(page), { markers: false });
    await markers(page, quickFilter(page, QUICK_FILTERS[0]).first(), "left", [40]);
  },

  // Suggestion and recent items depend on the account's history; the results behind the dropdown change too
  mask: (page) => [searchDialog(page).locator('[role="listbox"]'), page.locator("table tbody")],

  checks: (page, c) => searchDropdownChecks(page, c),
});
