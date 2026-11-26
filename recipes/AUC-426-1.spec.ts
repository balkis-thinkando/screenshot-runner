// Lesson:  AUC-426 - Organize your work in Jira Service Management
//          https://community.atlassian.com/learning/lesson/how-to-organize-work-in-jira-service-management
// Image:   #1, section "Navigate your queues" (All open tickets queue, old navigation: All queues panel, search and first row with column callouts outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/lbm25ovhg41lwc1n21g074nfcjws7ru2.png
// Recipe:  public.screenshot_recipes where asset_id = 'lbm25ovhg41lwc1n21g074nfcjws7ru2'
// Opens the IT Support (ITS) "All open tickets" queue (stand-in for IT Operations). The lesson's "All queues" panel is now
// the Queues list in the sidebar; that list, the search box and the first row are outlined. People become fake names.

import { runRecipe } from "../lib/recipe";
import { jsmTweaks, openItsQueue, queueChecks, queueMask, queueRows, checkTexts, checkControl, columns, mainArea, sidebarItem, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const QUEUES = ["All open tickets", "All my tickets", "Open tasks"];

runRecipe({
  file: "AUC-426-1",
  assetId: "lbm25ovhg41lwc1n21g074nfcjws7ru2",
  title: "AUC-426 #1 - Queue with queue list and columns",
  product: "jira",

  navigate: (page, s) => openItsQueue(page, s),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    const queueLinks = QUEUES.map((q) => page.getByRole("link", { name: new RegExp(`^${q}`) }).first());
    await spotlightAreas(page, await visibleAreas([queueLinks, mainArea(page).getByPlaceholder(/Search/).first(), [page.getByRole("columnheader").first().locator("xpath=.."), queueRows(page).first()]]));
  },

  mask: queueMask,

  async checks(page, c) {
    await c.check("Queue list: All open tickets, All my tickets, Open tasks (lesson: 'All queues' panel)", async () => {
      const missing: string[] = [];
      for (const q of QUEUES) if (!(await page.getByRole("link", { name: new RegExp(`^${q}`) }).first().isVisible().catch(() => false))) missing.push(q);
      const panel = await page.getByText("All queues", { exact: true }).first().isVisible().catch(() => false);
      return { pass: !missing.length, detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}queues are listed in the sidebar${panel ? " and an 'All queues' panel" : " (UI change: no 'All queues' panel next to the list)"}` };
    });
    await queueChecks(c, page, ["T", "Request Type", "Key", "P", "Summary", "Reporter", "Assignee", "Status", "Created"]);
    await c.check("Column 'Time to resolution' (SLA)", async () => {
      const text = (await columns(page)).join(" ");
      return { pass: text.includes("Time to resolution"), detail: text.includes("Time to resolution") ? "Present" : "Not in the visible columns (test data: ITS queue columns)" };
    });
    await c.check("Search box above the list", async () => {
      const v = await mainArea(page).getByPlaceholder(/Search/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
