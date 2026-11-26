// Lesson:  AUC-729 - Share dashboards in Jira
//          https://community.atlassian.com/learning/lesson/how-to-share-a-dashboard-in-jira
// Image:   #2, section "Find shared dashboards" (Dashboards directory with owners, viewers and editors; nothing
//          outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2xj8gq3q84c17l2f68ce8772l45n4m1u.png
// Recipe:  public.screenshot_recipes where asset_id = '2xj8gq3q84c17l2f68ce8772l45n4m1u'
// Opens Dashboards > View all dashboards. The test site lists its own dashboards (no "HR - Human Resources" or
// "Operations Dashboard"); owners and editors are shown with fake names.

import { runRecipe } from "../lib/recipe";
import { basicTweaks, fakeListedPeople, openPage } from "../lib/b3-jreports";

runRecipe({
  file: "AUC-729-2",
  assetId: "2xj8gq3q84c17l2f68ce8772l45n4m1u",
  title: "AUC-729 #2 - Dashboards directory",
  product: "jira",

  async navigate(page, s) {
    await openPage(page, s, "/jira/dashboards", (p) => p.getByRole("heading", { name: "Dashboards", exact: true }), "Dashboards directory");
    await page.locator('[data-testid="page-layout.main"] table tbody tr').nth(2).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeListedPeople(page.locator("table"));
    await basicTweaks(page, s);
  },

  // Which dashboards exist and who stars them changes over time
  mask: (page) => [page.locator('[data-testid="page-layout.main"] table tbody')],

  async checks(page, c) {
    await c.check("Title 'Dashboards' and 'Create dashboard' button", async () => {
      const h = await page.getByRole("heading", { name: "Dashboards", exact: true }).isVisible();
      const b = await page.getByRole("button", { name: "Create dashboard" }).or(page.getByRole("link", { name: "Create dashboard" })).first().isVisible();
      return { pass: h && b, detail: `Title: ${h}; Create dashboard: ${b}` };
    });

    await c.check("Filters: Search dashboards, Owner, Space, Group", async () => {
      const search = await page.getByPlaceholder("Search dashboards").isVisible().catch(() => false);
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const missing = ["Owner", "Space", "Group"].filter((t) => !text.includes(t));
      return { pass: search && !missing.length, detail: `Search: ${search}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Columns: Name, Owner, Viewers, Editors, Starred by", async () => {
      const cols = (await page.locator('[data-testid="page-layout.main"] table thead th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const missing = ["Name", "Owner", "Viewers", "Editors", "Starred by"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Sharing values shown: Public, My organization, a space with roles, Private", async () => {
      const text = await page.locator('[data-testid="page-layout.main"] table').innerText();
      const found = ["Public", "My organization", "All roles", "Private"].filter((t) => text.includes(t));
      return { pass: found.length >= 3, detail: `Found: ${found.join(", ")}` };
    });

    await c.check("Each row has a star and a More actions button", async () => {
      const rows = await page.locator('[data-testid="page-layout.main"] table tbody tr').count();
      const more = await page.getByRole("button", { name: /^More actions for / }).count();
      return { pass: rows > 0 && more >= rows, detail: `Rows: ${rows}; More actions buttons: ${more}` };
    });

    await c.check("Sidebar Dashboards section with 'View all dashboards'", async () => {
      const ok = await page.getByRole("link", { name: "View all dashboards" }).first().isVisible().catch(() => false);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });
  },
});
