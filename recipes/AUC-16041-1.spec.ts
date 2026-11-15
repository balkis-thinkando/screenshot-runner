// Lesson:  AUC-16041 - Understand Rovo data handling and residency
//          https://community.atlassian.com/learning/lesson/understand-rovo-data-handling-and-residency
// Image:   #1, section "Viewing Rovo's data residency details" (details outlined, hotspot markers)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/u6s754x64ldu2523e4y1201c5uyppsmu.png
// Recipe:  public.screenshot_recipes where asset_id = 'u6s754x64ldu2523e4y1201c5uyppsmu'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openOrgOverview, openOrgPath, sidebarLabels } from "../lib/admin";
import { anonymize, markers, renameOrg, spotlightAreas } from "../lib/tweaks";

const main = '[data-testid="main"]';
const header = '[data-testid="info-block-wrapper"]';
const setLocation = '[data-testid="data-residency-app-details-header-action"]';
const banner = (page: Page) => page.locator(main).getByText(/app instances are linked/i).first();
const marketplace = (page: Page) => page.locator(`${main} h4`, { hasText: "Marketplace apps" });

runRecipe({
  file: "AUC-16041-1",
  assetId: "u6s754x64ldu2523e4y1201c5uyppsmu",
  title: "AUC-16041 #1 - Data residency, Jira app details",
  product: "admin",

  async navigate(page, s) {
    await openOrgOverview(page, s);
    // Data management > Data residency, then the Jira row of the App summary
    await openOrgPath(page, s, "data-residency", /Data residency/);
    await page.locator('a:has([data-testid="JiraIcon--wrapper"]), button:has([data-testid="JiraIcon--wrapper"])').first().click();
    await page.locator(header).waitFor({ timeout: 30_000 });
    await page.locator('[data-testid^="app-details-section-table"]').first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    // Site URLs in lower case (apex.atlassian.net), then the org name
    await renameOrg(page, `${s.test_org}.atlassian`, `${s.display_org_name.toLowerCase()}.atlassian`);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // One outlined area from the app header down to the Marketplace apps list, markers on the parts the lesson names
    await spotlightAreas(page, [[page.locator(header), page.locator('[data-testid^="app-details-section-table"]').first()]]);
    // (a marker on the banner would cover its icon)
    await markers(page, page.locator(setLocation).or(marketplace(page)), "left", [70]);
  },

  // Marketplace apps installed on the test site
  mask: (page) => [page.locator('[data-testid^="app-details-section-table--cell"]')],

  async checks(page, c) {
    await c.check("Sidebar: Data management > Data transfer, Backup and restore, Data residency, Link fixing", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Data management", "Data transfer", "Backup and restore", "Data residency", "Link fixing"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Breadcrumbs Admin / Security / Data Residency and title 'App details'", async () => {
      const crumbs = (await page.locator(`${main} a`).allInnerTexts()).slice(0, 3).map((t) => t.trim());
      const title = await page.getByRole("heading", { name: "App details", exact: true }).isVisible();
      const pass = JSON.stringify(crumbs) === JSON.stringify(["Admin", "Security", "Data Residency"]) && title;
      return { pass, detail: `Breadcrumbs: ${crumbs.join(" / ")}; App details heading: ${title ? "present" : "missing"}` };
    });

    await c.check("App header: site URL, Jira, Atlassian app location", async () => {
      const site = (await page.locator(`${header} h1`).innerText()).trim();
      const jira = await page.locator(`${header} [data-testid="JiraIcon--wrapper"]`).isVisible();
      const location = await page.getByText(/Atlassian app location/i).first().isVisible();
      return { pass: /atlassian\.net$/.test(site) && jira && location, detail: `Site: ${site ? "shown" : "missing"}; Jira icon: ${jira}; location label: ${location}` };
    });

    await c.check("Buttons: Set location, Move Marketplace apps", async () => {
      const set = await page.locator(setLocation).isVisible();
      const move = await page.getByRole("button", { name: "Move Marketplace apps" }).first().isVisible();
      return { pass: set && move, detail: `Set location: ${set}; Move Marketplace apps: ${move}` };
    });

    await c.check("Banner: all Jira app instances are linked", async () => {
      const shown = await banner(page).isVisible();
      return { pass: shown, detail: shown ? "Present" : "Not found" };
    });

    await c.check("Marketplace apps section with columns Marketplace app, Location, Supported locations", async () => {
      const heading = await marketplace(page).isVisible();
      const cols = (await page.locator('[data-testid="app-details-section-table--head--cell"]').allInnerTexts()).map((t) => t.trim());
      const pass = heading && JSON.stringify(cols) === JSON.stringify(["Marketplace app", "Location", "Supported locations"]);
      return { pass, detail: `Heading: ${heading}; columns: ${cols.join(", ")}` };
    });
  },
});
