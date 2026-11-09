// Lesson:  AUC-16081 — Use Rovo across your organization
//          https://community.atlassian.com/learning/lesson/use-atlassian-intelligence-across-your-organization
// Image:   #1, section "Start using Rovo AI features" (no annotations)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/3r27w32eh1w72437672xav6642be0yvc.png
// Recipe:  public.screenshot_recipes where asset_id = '3r27w32eh1w72437672xav6642be0yvc'
// The lesson's path (Apps > AI settings > AI-enabled apps) no longer exists; the closest page today is
// AI and Rovo > Access ("Rovo access"). The checks describe the lesson image, so they flag the change.

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebar } from "../lib/admin";
import { anonymize, renameOrg } from "../lib/tweaks";

runRecipe({
  file: "AUC-16081-1",
  assetId: "3r27w32eh1w72437672xav6642be0yvc",
  title: "AUC-16081 #1 — AI-enabled apps in Atlassian Administration",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "AI and Rovo", "Access", /Rovo access|AI-enabled apps/);
    // Wait for the app list (or today's blocklist) instead of the loading placeholders
    await page.getByText(/^Showing \d+ items?$|^Select apps$/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
  },

  async checks(page, c) {
    await c.check("Sidebar: Apps > AI settings > Rovo, AI-enabled apps, Rovo MCP server", async () => {
      const labels = (await page.locator(`${sidebar} a, ${sidebar} button`).allInnerTexts()).map((t) => t.trim());
      const missing = ["AI settings", "AI-enabled apps", "Rovo MCP server"].filter((t) => !labels.some((l) => l.startsWith(t)));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}. Sidebar: ${labels.filter(Boolean).join(", ")}` : "Present" };
    });

    await c.check("Page title reads 'AI-enabled apps'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "AI-enabled apps", detail: `"${h1}"` };
    });

    await c.check("Tabs: Apps, Beta features, Web search", async () => {
      const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.replace(/\s*BETA\s*$/i, "").trim());
      const pass = JSON.stringify(tabs) === JSON.stringify(["Apps", "Beta features", "Web search"]);
      return { pass, detail: tabs.length ? `Tabs: ${tabs.join(", ")}` : "No tabs" };
    });

    await c.check("Select apps button, and a Remove action for each app", async () => {
      const select = await page.getByRole("button", { name: "Select apps", exact: true }).isVisible().catch(() => false);
      const removes = await page.getByRole("button", { name: "Remove", exact: true }).or(page.getByRole("link", { name: "Remove", exact: true })).count();
      return { pass: select && removes > 0, detail: `Select apps: ${select ? "present" : "missing"}; Remove actions: ${removes}` };
    });
  },
});
