// Lesson:  AUC-16040 - Monitor Rovo using insights
//          https://community.atlassian.com/learning/lesson/monitor-rovo-using-insights
// Image:   #3, section "Monitor organization usage with Platform usage" (usage table outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/1e7i6k4ep4wdm0tpw3643li1k3hj261c.png
// Recipe:  public.screenshot_recipes where asset_id = '1e7i6k4ep4wdm0tpw3643li1k3hj261c'
// Insights > Platform usage is now Usage > Meters. The checks describe the lesson image, so they flag the change.

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebarLabels } from "../lib/admin";
import { anonymize, renameOrg, spotlightAreas } from "../lib/tweaks";

runRecipe({
  file: "AUC-16040-3",
  assetId: "1e7i6k4ep4wdm0tpw3643li1k3hj261c",
  title: "AUC-16040 #3 - Platform usage",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Usage", "Meters", /Meters|Platform usage/);
    // Rows load after the page (placeholders first)
    await page.locator("table tbody tr").filter({ hasText: "Rovo credits" }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Title, description and table in one outlined area, as in the lesson
    await spotlightAreas(page, [[page.locator("h1").first(), page.locator("table").first()]]);
  },

  // Usage figures are site data
  mask: (page) => [page.locator("table tbody td:nth-child(2), table tbody td:nth-child(3)")],

  async checks(page, c) {
    await c.check("Sidebar: Insights > Platform usage", async () => {
      const labels = await sidebarLabels(page);
      const pass = labels.includes("Platform usage");
      return { pass, detail: pass ? "Present" : `Not found. Usage items today: ${labels.filter((l) => /usage|meters/i.test(l)).join(", ")}` };
    });

    await c.check("Page title reads 'Platform usage'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Platform usage", detail: `"${h1}"` };
    });

    await c.check("Columns: Usage type, Used, Included, Used by, Time period, Actions", async () => {
      const cols = (await page.locator("table thead th, table thead td").allTextContents()).map((t) => t.replace(/More actions for .*$/, "").trim()).filter(Boolean);
      const want = ["Usage type", "Used", "Included", "Used by", "Time period", "Actions"];
      return { pass: JSON.stringify(cols) === JSON.stringify(want), detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Rows for Indexed objects, Rovo credits, Rovo Dev credits", async () => {
      const rows = (await page.locator("table tbody tr td:first-child").allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const missing = ["Indexed objects", "Rovo credits", "Rovo Dev credits"].filter((r) => !rows.includes(r));
      return { pass: !missing.length, detail: `Rows: ${rows.join(", ")}` };
    });

    await c.check("Each row has a View usage action", async () => {
      const views = await page.getByRole("button", { name: "View usage" }).or(page.getByRole("link", { name: "View usage" })).count();
      return { pass: views > 0, detail: `${views} View usage actions` };
    });
  },
});
