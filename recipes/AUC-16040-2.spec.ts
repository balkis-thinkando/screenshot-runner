// Lesson:  AUC-16040 - Monitor Rovo using insights
//          https://community.atlassian.com/learning/lesson/monitor-rovo-using-insights
// Image:   #2, section "Access Rovo usage statistics with Analytics in Insights" (filters marked)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/1247u70gawu3k30or01503lr72547lyw.png
// Recipe:  public.screenshot_recipes where asset_id = '1247u70gawu3k30or01503lr72547lyw'
// The lesson's Insights > Analytics > AI usage tab no longer exists; Rovo usage now lives in AI and Rovo > Trends
// ("Rovo trends"), which is captured instead. The checks describe the lesson image, so they flag the change.

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebarLabels } from "../lib/admin";
import { anonymize, renameOrg } from "../lib/tweaks";

runRecipe({
  file: "AUC-16040-2",
  assetId: "1247u70gawu3k30or01503lr72547lyw",
  title: "AUC-16040 #2 - AI usage analytics",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "AI and Rovo", "Trends", /Rovo trends|Analytics/);
    await page.locator("main svg, [data-testid='main'] svg").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
  },

  // Numbers, dates and charts are site data
  mask: (page) => [page.locator("[data-testid='main'] svg, main svg"), page.getByText(/^\d[\d,.]*K?$/), page.getByText(/\d{4}\s*$/).first()],

  async checks(page, c) {
    await c.check("Page title reads 'Analytics' (Insights > Analytics)", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Analytics", detail: `"${h1}"` };
    });

    await c.check("Tab 'AI usage' is shown and selected", async () => {
      const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.trim());
      const selected = await page.getByRole("tab", { name: "AI usage", selected: true }).isVisible().catch(() => false);
      return { pass: selected, detail: `Tabs: ${tabs.join(", ") || "none"}` };
    });

    await c.check("Card 'Active AI users' with time range and site filters", async () => {
      const card = await page.getByText("Active AI users", { exact: true }).first().isVisible();
      const range = await page.getByRole("button", { name: /^Last \d+ (months|weeks|days)/ }).first().isVisible();
      const sites = await page.getByRole("button", { name: /^All sites/ }).first().isVisible();
      return { pass: card && range && sites, detail: `Active AI users card: ${card}; time range: ${range}; All sites: ${sites}` };
    });

    await c.check("Sidebar: AI and Rovo > Trends (where Rovo usage is today)", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["AI and Rovo", "Trends"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });
  },
});
