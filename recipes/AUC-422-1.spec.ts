// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #1, section "What are work items and requests?" (All open tickets queue of IT Operations, old navigation; one request row outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/1ed2773v76we4yhl8fmu16g05ok450g3
// Recipe:  public.screenshot_recipes where asset_id = '1ed2773v76we4yhl8fmu16g05ok450g3'
// Opens the IT Support (ITS) "All open tickets" queue (stand-in for IT Operations) and outlines the first row.
// People in the Reporter and Assignee columns become fake names. Nothing is starred or changed.

import { runRecipe } from "../lib/recipe";
import { jsmTweaks, openItsQueue, queueChecks, queueMask, queueRows, checkTexts, checkControl, mainArea, sidebarItem, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-422-1",
  assetId: "1ed2773v76we4yhl8fmu16g05ok450g3",
  title: "AUC-422 #1 - Queue with one request highlighted",
  product: "jira",

  navigate: (page, s) => openItsQueue(page, s),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await outline(page, queueRows(page).first());
  },

  mask: queueMask,

  async checks(page, c) {
    await queueChecks(c, page, ["T", "Request Type", "Key", "P", "Summary", "Reporter"]);
    await c.check("Search box above the list", async () => {
      const v = await mainArea(page).getByPlaceholder(/Search/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
