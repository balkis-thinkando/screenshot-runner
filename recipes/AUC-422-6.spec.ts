// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #6, section "Navigate in a space" (Commercial Legal Service Desk queue; sidebar outlined with markers on For you, Spaces, Queues, Multi-space work, Reports, Knowledge Base, Channels, Customer notifications)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12IV.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12IV'
// Opens the IT Support (ITS) "All open tickets" queue (stand-in for CLSD) and outlines the sidebar (the lesson's
// markers are left out: the sidebar is taller than the window, so the items below Knowledge Base are cut off). People become fake names.

import { runRecipe } from "../lib/recipe";
import { jsmTweaks, openItsQueue, queueChecks, queueMask, queueRows, checkTexts, checkControl, mainArea, sidebarItem, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const SIDEBAR = ["For you", "Recent", "Starred", "Apps", "Roadmaps", "Plans", "Spaces", "Queues", "Multi-space work", "Reports", "Knowledge Base", "Customers", "Channels", "Add shortcut"];
const sidebar = (page: import("@playwright/test").Page) => page.locator('[data-testid="page-layout.sidebar"], nav[aria-label*="Sidebar" i], [data-testid*="side-nav"]').first();

runRecipe({
  file: "AUC-422-6",
  assetId: "AT12IV",
  title: "AUC-422 #6 - Service space sidebar items",
  product: "jira",

  navigate: (page, s) => openItsQueue(page, s),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await spotlightAreas(page, await visibleAreas([sidebar(page)]));
  },

  mask: queueMask,

  async checks(page, c) {
    await checkTexts(c, `Sidebar: ${SIDEBAR.join(", ")}`, page, SIDEBAR, sidebar(page));
    await checkTexts(c, "Sidebar: Customer notification logs", page, ["Customer notificatio"], sidebar(page), "UI change (renamed 'Email logs' in Nov 2026?). ");
    await checkTexts(c, "Sidebar: Raise a request", page, ["Raise a request"], sidebar(page), "UI change (no longer in the space sidebar?). ");
    await queueChecks(c, page, ["T", "Key", "Summary", "Reporter"]);
  },
});
