// Lesson:  AUC-12979 - Automate code reviews with Rovo
//          https://community.atlassian.com/learning/lesson/automate-code-reviews-with-rovo
// Image:   #1, section "Review a pull request with Rovo" (Rovo Dev row outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/5763o6136p6yv52671817r6f6fe7v45u.png
// Recipe:  public.screenshot_recipes where asset_id = '5763o6136p6yv52671817r6f6fe7v45u'

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebarLabels } from "../lib/admin";
import { anonymize, renameOrg, spotlight } from "../lib/tweaks";

const rovoDev = '[data-testid^="workspaces-table--row"]:has([aria-label="Rovo Dev"])';

runRecipe({
  file: "AUC-12979-1",
  assetId: "5763o6136p6yv52671817r6f6fe7v45u",
  title: "AUC-12979 #1 - Atlassian apps, Rovo Dev",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Apps", "Atlassian apps", /Atlassian apps/);
    await page.locator('[data-testid^="workspaces-table--row"]').first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    // Site URLs in lower case (apex.atlassian.net), then the org name
    await renameOrg(page, `${s.test_org}.atlassian`, `${s.display_org_name.toLowerCase()}.atlassian`);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    await spotlight(page, page.locator(rovoDev), { markers: false });
  },

  // User counts and plans are site data
  mask: (page) => [page.locator('[data-testid="workspaces-table--cell-2"]')],

  async checks(page, c) {
    await c.check("Sidebar: Apps > Atlassian apps, App access settings, User requests, App URLs", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Atlassian apps", "App access settings", "User requests", "App URLs"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title 'Atlassian apps' with an Add app button", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const add = await page.getByRole("button", { name: "Add app", exact: true }).isVisible();
      return { pass: h1 === "Atlassian apps" && add, detail: `"${h1}"; Add app: ${add}` };
    });

    await c.check("Filters: search by name, Apps, Plans", async () => {
      const search = await page.getByPlaceholder(/^(Find|Search) by name/).isVisible();
      const apps = await page.getByRole("button", { name: /^Apps/ }).first().isVisible();
      const plans = await page.getByRole("button", { name: /^Plans/ }).first().isVisible();
      return { pass: search && apps && plans, detail: `Search: ${search}; Apps: ${apps}; Plans: ${plans}` };
    });

    await c.check("Columns: App, Plan, Users, Actions", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
      const missing = ["App", "Plan", "Users", "Actions"].filter((c) => !cols.some((t) => t.startsWith(c)));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Rovo Dev is listed, with its rovodev URL and an app link", async () => {
      const row = page.locator(rovoDev);
      const text = (await row.count()) ? await row.innerText() : "";
      const manage = (await row.locator('[aria-label="Manage app"], button:has-text("Manage app")').count()) > 0;
      return { pass: /\/rovodev/.test(text) && manage, detail: text ? `Row found; Manage app: ${manage}` : "No Rovo Dev row" };
    });
  },
});
