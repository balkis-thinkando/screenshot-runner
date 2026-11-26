// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #3, section "What are spaces and portals?" (All open tickets queue in the new navigation: List tab, search, Request type, Status, Assignee, More filters, Triage; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12GI.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12GI'
// Opens the IT Support (ITS) "All open tickets" queue (stand-in for IT Operations). People become fake names.

import { runRecipe } from "../lib/recipe";
import { jsmTweaks, openItsQueue, queueChecks, queueMask, queueRows, checkTexts, checkControl, mainArea, sidebarItem } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-422-3",
  assetId: "AT12GI",
  title: "AUC-422 #3 - Service space queue with filters",
  product: "jira",

  navigate: (page, s) => openItsQueue(page, s),
  tweak: (page, s) => jsmTweaks(page, s),
  mask: queueMask,

  async checks(page, c) {
    await queueChecks(c, page);
    await c.check("'List' view tab", async () => {
      const v = await mainArea(page).getByText("List", { exact: true }).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await checkTexts(c, "Filters: Request type, Status, Assignee, More filters; Triage button", page, ["Request type", "Status", "Assignee", "More filters", "Triage"], mainArea(page));
    await c.check("Work item count ('N work items')", async () => {
      const v = await page.getByText(/^\d+ work items?$/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await c.check("No AI filter button before the search box (the lesson has none)", async () => {
      const ai = await mainArea(page).getByRole("button", { name: /^AI$/ }).first().isVisible().catch(() => false);
      return { pass: !ai, detail: ai ? "UI change: an AI button now sits before the search box" : "None" };
    });
  },
});
