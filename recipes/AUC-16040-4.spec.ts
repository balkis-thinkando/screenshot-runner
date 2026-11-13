// Lesson:  AUC-16040 - Monitor Rovo using insights
//          https://community.atlassian.com/learning/lesson/monitor-rovo-using-insights
// Image:   #4, section "Explore Rovo credits usage" (sidebar item, Usage tab and content outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/f8j7uw5b374w84o042dn0wh5aqvx45hi.png
// Recipe:  public.screenshot_recipes where asset_id = 'f8j7uw5b374w84o042dn0wh5aqvx45hi'
// Insights > Platform usage is now Usage > Meters; Rovo credits opens from its row.

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebar, sidebarLabels } from "../lib/admin";
import { anonymize, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

runRecipe({
  file: "AUC-16040-4",
  assetId: "f8j7uw5b374w84o042dn0wh5aqvx45hi",
  title: "AUC-16040 #4 - Rovo credits usage",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Usage", "Meters", /Meters|Platform usage/);
    await page.locator("table tbody tr").filter({ hasText: /^Rovo credits/ }).getByText("Rovo credits", { exact: true }).first().click();
    await page.locator("h1", { hasText: "Rovo credits" }).waitFor({ timeout: 30_000 });
    await page.locator("main svg, [data-testid='main'] svg").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    await hideMessages(page, ["Prepare for usage-based billing"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Sidebar item, the Usage tab, and the usage cards below it
    const usageTab = page.getByRole("tab", { name: "Usage", exact: true });
    // The deepest block holding both the summary cards and the credits chart
    const content = page.locator("div").filter({ has: page.getByText(/^Monthly average$/) }).filter({ has: page.getByText(/^(Credits this period|Rovo credits usage)$/) }).last();
    await spotlightAreas(page, [page.locator(`${sidebar} a`).filter({ hasText: /^(Meters|Platform usage)$/ }), usageTab, content]);
  },

  // Credits, dates and charts are site data
  mask: (page) => [page.locator("main svg, [data-testid='main'] svg"), page.getByText(/\d[\d,.]*\s*(K|credits)?$/)],

  async checks(page, c) {
    await c.check("Sidebar: Insights > Platform usage", async () => {
      const labels = await sidebarLabels(page);
      const pass = labels.includes("Platform usage");
      return { pass, detail: pass ? "Present" : `Not found. Usage items today: ${labels.filter((l) => /usage|meters/i.test(l)).join(", ")}` };
    });

    await c.check("Breadcrumb 'Platform usage' and title 'Rovo credits'", async () => {
      const crumb = await page.getByRole("link", { name: "Platform usage", exact: true }).or(page.getByText("Platform usage", { exact: true })).first().isVisible();
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: crumb && h1 === "Rovo credits", detail: `Breadcrumb: ${crumb ? "Platform usage" : "not 'Platform usage'"}; title: "${h1}"` };
    });

    await c.check("Tabs: Usage, Apps, Users", async () => {
      const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.trim());
      return { pass: JSON.stringify(tabs) === JSON.stringify(["Usage", "Apps", "Users"]), detail: `Tabs: ${tabs.join(", ")}` };
    });

    await c.check("Monthly average card", async () => {
      const shown = await page.getByText("Monthly average", { exact: true }).first().isVisible();
      return { pass: shown, detail: shown ? "Present" : "Not found" };
    });

    await c.check("Rovo credits usage chart with Last 30 days and App filters", async () => {
      const chart = await page.getByText("Rovo credits usage", { exact: true }).first().isVisible();
      const range = await page.getByRole("button", { name: /^Last 30 days/ }).first().isVisible();
      const app = await page.getByRole("button", { name: /^App$/ }).first().isVisible();
      return { pass: chart && range && app, detail: `Chart: ${chart}; Last 30 days: ${range}; App filter: ${app}` };
    });
  },
});
