// Lesson:  AUC-670 - Set up your services in Jira Service Management
//          https://community.atlassian.com/learning/lesson/jira-service-management-services-setup
// Image:   #4, section "Configure service relationships" (Billing service page: Service relationships form with the relationship type dropdown open (Depends on, Used by), a service picked, Cancel and Add)
//          https://dam-cdn.atl.orangelogic.com/public/AT14Q47.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q47'
// Needs test data: the site has no services (Nov 2026), so no service page can be opened. The recipe reaches
// Operations > Services (closest real screen). Nothing is created or added.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-670-4",
  assetId: "AT14Q47",
  title: "AUC-670 #4 - Service relationships form",
  product: "jira",

  navigate: (page, s) => openAndWait(page, s, "/jira/ops/services", (p) => p.getByRole("button", { name: "Create service" })),
  tweak: (page, s) => jsmTweaks(page, s),

  async checks(page, c) {
    await c.check("A service page (lesson: Billing) can be opened", async () => {
      const n = await page.locator("table tbody tr a").count();
      return { pass: false, detail: n ? `Needs test data: ${n} services exist; pick one and extend the recipe` : "Needs test data: the site has no services" };
    });
    await c.check("Service relationships form (Depends on / Used by, service picker, Cancel, Add)", async () => ({ pass: false, detail: "Needs test data: not reachable without a service" }));
    await checkHeading(c, "Operations > Services page", page, "Services");
  },
});
