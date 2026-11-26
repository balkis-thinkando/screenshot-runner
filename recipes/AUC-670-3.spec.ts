// Lesson:  AUC-670 - Set up your services in Jira Service Management
//          https://community.atlassian.com/learning/lesson/jira-service-management-services-setup
// Image:   #3, section "Create a service" (Create service dialog over the services list: Name, Service Type, Tier, Service Owners, Change approvers; Cancel and Create)
//          https://dam-cdn.atl.orangelogic.com/public/AT14Q26.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q26'
// Opens Operations > Services (services moved there from the space's Operations page in Nov 2026) and clicks
// Create service. Nothing is typed and Create is never clicked.
// Nov 2026: the button opens a "Create object" form (Assets Schema and Object Type), not the lesson's service form.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Create (service|object)/ }).first();

runRecipe({
  file: "AUC-670-3",
  assetId: "AT14Q26",
  title: "AUC-670 #3 - Create service dialog",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/ops/services", (p) => p.getByRole("button", { name: "Create service" }));
    await page.getByRole("button", { name: "Create service" }).first().click();
    await dialog(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  tweak: (page, s) => jsmTweaks(page, s),

  async checks(page, c) {
    await c.check("Dialog 'Create service'", async () => {
      const h = await textOf(dialog(page).getByRole("heading").first());
      return { pass: h === "Create service", detail: h === "Create service" ? "Present" : `UI change: Create service opens "${h}" (an Assets object form: Schema, Object Type)` };
    });
    await checkTexts(c, "Fields: Name, Service Type, Tier, Service Owners, Change approvers", page, ["Name", "Service Type", "Tier", "Service Owners", "Change approvers"], dialog(page), "UI change: ");
    await checkTexts(c, "Required fields note and Compass sync note", page, ["required", "Compass"], dialog(page), "UI change: ");
    await checkTexts(c, "Buttons Cancel and Create", page, ["Cancel", "Create"], dialog(page));
    await c.check("Services list behind the dialog (lesson: the space's Operations page)", async () => {
      const n = await page.locator("table tbody tr").count();
      return { pass: n > 0, detail: n ? `${n} services` : "Needs test data: no services; UI change: services now live under Operations > Services" };
    });
  },
});
