// Lesson:  AUC-1755 - Visualize your team's work with the Summary view in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-project-summary
// Image:   #2, section "Add the Summary view to your space" (Calendar view, add view (+) menu with Summary chosen;
//          the + button, Summary and the details pane are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0d8lg1pwx6i332uhhjd68q425na3y7pp.png
// Recipe:  public.screenshot_recipes where asset_id = '0d8lg1pwx6i332uhhjd68q425na3y7pp'
// Stand-in space: M0025 - Nebula Launch Squad (LSS25), the only space found without a Summary view. Its Calendar with
// the add view (+) menu open. No view is added: nothing in the menu is clicked. The pointer rests on Summary, shown
// as the chosen option with the lesson description (display only; the illustration stays the first option's).
// Sidebar hidden, display only; the Unscheduled work panel is closed. The calendar month follows today's date, so
// it is masked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import {
  addViewButton, addViewChecks, addViewDetails, addViewOption, calendarToday, fakeSpacePeople, hideJiraSidebar, openSpaceView, showAddViewOption, tabsCheck,
  unscheduledToggle, VIEW_DESCRIPTIONS,
} from "../lib/b3-jsearch";

let offered = false;

runRecipe({
  file: "AUC-1755-2",
  assetId: "0d8lg1pwx6i332uhhjd68q425na3y7pp",
  title: "AUC-1755 #2 - Add view menu, Summary",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/c/projects/LSS25/boards/365/calendar", calendarToday(page), "the LSS25 Calendar");
    await hideJiraSidebar(page);
    // The lesson's Calendar has the Unscheduled work panel closed (a view toggle, nothing saved)
    if (await page.getByRole("heading", { name: "Unscheduled work" }).isVisible().catch(() => false)) {
      await unscheduledToggle(page).click();
      await page.waitForTimeout(1_500);
    }
    offered = await showAddViewOption(page, "Summary", VIEW_DESCRIPTIONS.Summary);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, ["LSS25"]);
    if (offered) await spotlightAreas(page, [addViewButton(page), addViewOption(page, "Summary"), addViewDetails(page)]);
  },

  mask: (page) => [page.locator('[role="grid"], [data-testid*="calendar.ui.main"]').first()],

  async checks(page, c) {
    await tabsCheck(page, c, "Calendar", ["Timeline", "Backlog", "Board", "Calendar", "List", "Goals", "All work", "Development", "Code"]);
    await addViewChecks(page, c, "Summary", offered, ["Deployments", "Forms", "Incidents", "Releases", "Reports", "Security", "Summary"]);
  },
});
