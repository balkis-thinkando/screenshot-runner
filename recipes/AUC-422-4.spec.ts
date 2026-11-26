// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #4, section "What are spaces and portals?" (Service Desk portal in the help center: announcement banner, portal name and description, 'Learn more about' knowledge categories, 'Need to raise a request? Contact us.')
//          https://dam-cdn.atl.orangelogic.com/AssetLink/q65v685nd61sffbasu0cp20y4up5a4r7
// Recipe:  public.screenshot_recipes where asset_id = 'q65v685nd61sffbasu0cp20y4up5a4r7'
// Opens the IT Support (ITS) portal in the help center ("Service Desk" in the lesson). Nothing is requested.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-422-4",
  assetId: "q65v685nd61sffbasu0cp20y4up5a4r7",
  title: "AUC-422 #4 - Help center portal with knowledge categories",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, `/servicedesk/customer/portal/${ITS.portalId}`, (p) => p.locator("h1"));
  },

  tweak: (page, s) => jsmTweaks(page, s),

  async checks(page, c) {
    await c.check("Portal name 'Service Desk' with description", async () => {
      const h = await textOf(page.locator("h1"));
      return { pass: h === "Service Desk", detail: `Heading: "${h}" (portal names are site data)` };
    });
    await checkTexts(c, "Breadcrumbs Help Center / portal", page, ["Help Center"], undefined, "Site data (the help center name is customisable). ");
    await c.check("'Learn more about' knowledge base categories", async () => {
      const v = await page.getByText("Learn more about").first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Needs test data: the portal shows no knowledge base categories (the test account cannot see the ITS knowledge base space)" };
    });
    await c.check("'Need to raise a request? Contact us.' (or the request type list)", async () => {
      const text = await textOf(page.locator("body"));
      const contact = text.includes("Need to raise a request?");
      return { pass: contact, detail: contact ? "Present" : "The portal lists request types directly (shown when it has no knowledge base)" };
    });
    await c.check("Portal announcement banner", async () => {
      const b = await page.locator('[data-testid*="announcement"]').first().isVisible().catch(() => false);
      return { pass: b, detail: b ? "Present" : "Needs test data: the portal has no announcement" };
    });
  },
});
