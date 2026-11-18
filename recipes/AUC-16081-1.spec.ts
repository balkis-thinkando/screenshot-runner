// Lesson:  AUC-16081 — Use Rovo across your organization
//          https://community.atlassian.com/learning/lesson/use-atlassian-intelligence-across-your-organization
// Image:   #1, section "Start using Rovo AI features" (no annotations)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/3r27w32eh1w72437672xav6642be0yvc.png
// Recipe:  public.screenshot_recipes where asset_id = '3r27w32eh1w72437672xav6642be0yvc'
// The lesson's path (Apps > AI settings > AI-enabled apps) no longer exists; the closest page today is
// AI and Rovo > Access ("Rovo access"). The checks describe the lesson image, so they flag the change.
// The test org blocks no apps, so the blocklist is empty. Display-only fake: the lesson's apps that exist on the
// test org (Compass and Atlassian Analytics do not), with their real icons from the Atlassian apps page, in the
// same table style as AUC-16036-1. Nothing is added to the real blocklist.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { goToOrgPage, openOrgOverview, openOrgPath, sidebar } from "../lib/admin";
import { anonymize, fakeButton, fakeTable, renameOrg, setCount } from "../lib/tweaks";

// Lesson order; the site shown under each app name
const APPS: [name: string, path: string][] = [
  ["Confluence", "/wiki"],
  ["Customer Service Management", ""],
  ["Talent", ""],
  ["Jira Product Discovery", ""],
  ["Focus", ""],
  ["Jira Service Management", ""],
  ["Jira", ""],
];
let icons: Record<string, string> = {};

/** Icons of the APPS that are on the Atlassian apps page (missing ones are left out). */
async function appIcons(page: Page) {
  await goToOrgPage(page, "Apps", "Atlassian apps", /Atlassian apps/);
  const cards = page.locator('[data-testid="product-card-icon-container"]');
  await cards.first().waitFor();
  const found: Record<string, string> = {};
  for (const [name] of APPS) {
    const icon = cards.filter({ has: page.locator(`[aria-label="${name}"]`) }).first();
    if (await icon.count()) found[name] = await icon.innerHTML();
  }
  return found;
}

runRecipe({
  file: "AUC-16081-1",
  assetId: "3r27w32eh1w72437672xav6642be0yvc",
  title: "AUC-16081 #1 — AI-enabled apps in Atlassian Administration",
  product: "admin",

  async navigate(page, s) {
    await openOrgOverview(page, s);
    icons = await appIcons(page);
    // Open the page fresh so the sidebar only expands AI and Rovo
    await openOrgPath(page, s, "rovo-access", /Rovo access|AI-enabled apps/);
    // Wait for the app list (or today's blocklist) instead of the loading placeholders
    await page.getByText(/^Showing \d+ items?$|^Select apps$/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no hover highlight left on the sidebar
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Only when the blocklist is empty: the lesson's apps as blocked apps
    const empty = page.locator('[data-testid="rovo-access-apps"] [data-testid="empty-state-stack"]');
    const apps = APPS.filter(([name]) => icons[name]);
    if (apps.length && (await empty.isVisible())) {
      const site = `${s.display_org_name.toLowerCase()}.atlassian.net`;
      await fakeTable(
        page,
        empty,
        [{ label: "App", width: "50%" }, { label: "Plan" }, { label: "Actions", width: "12%", align: "right" }],
        apps.map(([name, path]) => [
          { html: `<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:inline-flex;width:32px">${icons[name]}</span><span><span style="display:block">${name}</span><span style="display:block;font-size:12px;color:#505258">${site}${path}</span></span></span>` },
          "Enterprise",
          { html: fakeButton("Remove") },
        ]),
      );
      await setCount(page, page.getByText(/^Showing 0 items$/), `Showing ${apps.length} items`);
    }
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
