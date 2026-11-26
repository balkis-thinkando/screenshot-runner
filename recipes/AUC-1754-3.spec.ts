// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #3, section "Add the Timeline and Calendar views to your space" (Employee Onboarding board, add view (+)
//          menu with Calendar chosen; Calendar and Add to navigation are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/137nk0de783614ul2vp88r3b15174u63.png
// Recipe:  public.screenshot_recipes where asset_id = '137nk0de783614ul2vp88r3b15174u63'
// Stand-in space: Employee Onboarding already has a Calendar, so it is not in its menu. M0018 - Community Events
// Office (MCE) has no Calendar or Timeline yet: its board with the add view (+) menu open. No view is added: nothing
// in the menu is clicked. The pointer rests on Calendar, shown as the chosen option with the lesson description
// (display only; the illustration stays the first option's). Sidebar hidden, display only. Board cards masked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import {
  addToNavigation, addViewChecks, addViewOption, fakeSpacePeople, hideJiraSidebar, openSpaceView, showAddViewOption, tabsCheck, VIEW_DESCRIPTIONS,
} from "../lib/b3-jsearch";

let offered = false;

runRecipe({
  file: "AUC-1754-3",
  assetId: "137nk0de783614ul2vp88r3b15174u63",
  title: "AUC-1754 #3 - Add view menu, Calendar",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/projects/MCE/boards/251", page.getByPlaceholder(/Search board/).first(), "the MCE board");
    await hideJiraSidebar(page);
    offered = await showAddViewOption(page, "Calendar", VIEW_DESCRIPTIONS.Calendar);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, ["MCE"]);
    if (offered) await spotlightAreas(page, [addViewOption(page, "Calendar"), addToNavigation(page)]);
  },

  mask: (page) => [page.locator('[data-testid*="board.content"], [data-testid*="platform-board-kit.ui.board"]').first()],

  async checks(page, c) {
    await tabsCheck(page, c, "Board", ["Summary", "Board", "List", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports", "Archived work items"]);
    await addViewChecks(page, c, "Calendar", offered, ["Board", "Calendar", "List", "Timeline"]);
  },
});
