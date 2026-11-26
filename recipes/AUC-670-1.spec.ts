// Lesson:  AUC-670 - Set up your services in Jira Service Management
//          https://community.atlassian.com/learning/lesson/jira-service-management-services-setup
// Image:   #1, section "What is a service?" (IT Support > Operations, Services tab: Create service, intro text, services table (Name, Type, Tier, Owner); the Operations sidebar item and the page outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT14Q5B.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q5B'
// Opens IT Support (ITS) > Operations > Services. Nov 2026: the tab says "Services have a new home" and links to
// Operations > Services, where the site has no services (test data). Nothing is created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-670-1",
  assetId: "AT14Q5B",
  title: "AUC-670 #1 - Services list in Operations",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/servicedesk/projects/ITS/services", (p) => p.getByRole("tab", { name: "Services" }).or(p.getByText("Services", { exact: true })));
    await page.getByText(/Services have a new home|Create service/).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await settle(page);
  },

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await spotlightAreas(page, await visibleAreas([page.locator("a[aria-current=page]:visible").filter({ hasText: "Operations" }).first(), mainArea(page)]));
  },

  async checks(page, c) {
    await checkHeading(c, "Heading 'Operations'", page, "Operations");
    await checkTexts(c, "Tabs: Change calendar, Services, Alerts, On-call", page, ["Change calendar", "Services", "Alerts", "On-call"], mainArea(page));
    await c.check("Services list with 'Create service' (Name, Type, Tier, Owner)", async () => {
      const moved = await page.getByText("Services have a new home").first().isVisible().catch(() => false);
      const create = await page.getByRole("button", { name: "Create service" }).first().isVisible().catch(() => false);
      const cols = await columns(page);
      const pass = create && ["Name", "Type", "Tier", "Owner"].every((w) => cols.includes(w));
      return { pass, detail: moved ? "UI change: the tab now says 'Services have a new home' with a 'Go to services' button (services moved to Operations > Services)" : `Create service: ${create}; columns: ${cols.join(", ")}` };
    });
    await c.check("Services listed (Billing, Customer Support, HR...)", async () => {
      const n = await page.locator("table tbody tr").count();
      return { pass: n > 0, detail: n ? `${n} rows` : "Needs test data: the site has no services" };
    });
  },
});
