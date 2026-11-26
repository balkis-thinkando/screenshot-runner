// Lesson:  AUC-426 - Organize your work in Jira Service Management
//          https://community.atlassian.com/learning/lesson/how-to-organize-work-in-jira-service-management
// Image:   #3, section "Filter work by request type" (All open tickets queue; sidebar items Service requests, Incidents, Problems, Changes, Post-incident reviews outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/4u21g57m5bi1464dgpwcxfgq430bsoy1
// Recipe:  public.screenshot_recipes where asset_id = '4u21g57m5bi1464dgpwcxfgq430bsoy1'
// Opens the IT Support (ITS) "All open tickets" queue (stand-in for IT Operations) and outlines the five work category
// items in the sidebar. People become fake names.

import { runRecipe } from "../lib/recipe";
import { jsmTweaks, openItsQueue, queueChecks, queueMask, queueRows, checkTexts, checkControl, mainArea, sidebarItem, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const CATEGORIES = ["Service requests", "Incidents", "Problems", "Changes", "Post-incident reviews"];

runRecipe({
  file: "AUC-426-3",
  assetId: "4u21g57m5bi1464dgpwcxfgq430bsoy1",
  title: "AUC-426 #3 - Sidebar request type categories",
  product: "jira",

  async navigate(page, s) {
    await openItsQueue(page, s);
    await sidebarItem(page, "Post-incident reviews").scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => {});
  },

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await spotlightAreas(page, await visibleAreas([CATEGORIES.map((n) => sidebarItem(page, n))]));
  },

  mask: queueMask,

  async checks(page, c) {
    await c.check(`Sidebar: ${CATEGORIES.join(", ")}`, async () => {
      const missing: string[] = [];
      for (const n of CATEGORIES) if (!(await sidebarItem(page, n).isVisible().catch(() => false))) missing.push(n);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
    await checkTexts(c, "Sidebar: Queues, All open tickets, Reports, Operations, Knowledge Base", page, ["Queues", "All open tickets", "Reports", "Operations", "Knowledge Base"]);
    await c.check("Sidebar: Views (lesson: 'Views NEW' under Queues)", async () => {
      const v = await sidebarItem(page, /^Views/).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "UI change: no Views item in the space sidebar" };
    });
    await queueChecks(c, page);
  },
});
