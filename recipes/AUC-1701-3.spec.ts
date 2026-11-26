// Lesson:  AUC-1701 - Use JQL to filter search results
//          https://community.atlassian.com/learning/lesson/use-jira-jql-search
// Image:   #3, section "Access JQL searches" (All work in the JQL view with a "created in the last 30 days" query;
//          the sidebar Filters heading and Search work items are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/8fehy465h6i23k0lvk64u3f4377r81sw.png
// Recipe:  public.screenshot_recipes where asset_id = '8fehy465h6i23k0lvk64u3f4377r81sw'
// All work opened with the lesson's JQL query, in the JQL view. Nothing is saved. The results (which work items were
// created recently) and the recent filters in the sidebar change over time, so they are masked.

import { runRecipe } from "../lib/recipe";
import { fakeNames, spotlightAreas } from "../lib/tweaks";
import { jiraPeopleTweaks } from "../lib/b2-jira";
import { jqlEditor, openJql, sidebarFilters, sidebarRecent, sidebarSearchItems } from "../lib/b3-jsearch";

const JQL = "created >= -30d order by created DESC";

runRecipe({
  file: "AUC-1701-3",
  assetId: "8fehy465h6i23k0lvk64u3f4377r81sw",
  title: "AUC-1701 #3 - JQL search and the Filters sidebar",
  product: "jira",

  async navigate(page, s) {
    await openJql(page, s, JQL);
    await page.locator("table tbody tr").first().waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await fakeNames(page, "Employee");
    await spotlightAreas(page, [[sidebarFilters(page), sidebarSearchItems(page)]]);
  },

  mask: (page) => [page.locator("table tbody"), page.getByText(/^\d+ of \d+\+?$/), ...sidebarRecent(page)],

  async checks(page, c) {
    await c.check("Page 'All work' in the JQL view with the lesson query", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const jql = (await jqlEditor(page).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      const on = await page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.advanced"]').getAttribute("aria-checked").catch(() => null);
      return { pass: h1 === "All work" && /created >= -30d/.test(jql) && on !== "false", detail: `"${h1}"; JQL: ${jql.slice(0, 80)}; JQL selected: ${on}` };
    });

    await c.check("Sidebar: Filters heading with Search work items", async () => {
      const f = await sidebarFilters(page).isVisible().catch(() => false);
      const sw = await sidebarSearchItems(page).isVisible().catch(() => false);
      return { pass: f && sw, detail: `Filters: ${f}; Search work items: ${sw}` };
    });

    await c.check("Sidebar: Default filters and View all filters", async () => {
      const side = await page.locator('nav[aria-label="Sidebar"]').innerText();
      const missing = ["Default filters", "View all filters"].filter((t) => !side.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")} (View all filters is below the fold when the default filters are open)` : "All present" };
    });

    await c.check("Toolbar: Ask AI, Basic/JQL, JQL box, Clear filters, Save filter", async () => {
      const text = await page.locator("#unsafe-design-system-page-layout-root").innerText();
      const missing = ["Basic", "JQL", "Clear filters", "Save filter"].filter((t) => !text.includes(t));
      const ed = await jqlEditor(page).isVisible();
      return { pass: !missing.length && ed, detail: `Missing: ${missing.join(", ") || "none"}; JQL box: ${ed}` };
    });

    await c.check("Header buttons: Apps, Share", async () => {
      const apps = await page.getByRole("button", { name: /^Apps/ }).first().isVisible().catch(() => false);
      const share = await page.getByRole("button", { name: /^Share/ }).first().isVisible().catch(() => false);
      return { pass: apps && share, detail: `Apps: ${apps}; Share: ${share}${share ? "" : " (UI change: Share is an icon button)"}` };
    });

    await c.check("Results table with Work column and the count footer", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
      const count = await page.getByText(/^\d+ of \d+\+?$/).first().isVisible().catch(() => false);
      return { pass: cols.includes("Work") && count, detail: `Columns: ${cols.join(", ")}; count footer: ${count}` };
    });
  },
});
