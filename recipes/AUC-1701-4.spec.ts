// Lesson:  AUC-1701 - Use JQL to filter search results
//          https://community.atlassian.com/learning/lesson/use-jira-jql-search
// Image:   #4, section "Learn the language of JQL queries" (All work in the Basic view with a "Created: Within the
//          last 30 days" filter; the whole filter bar is outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/3gyxod5b1f1kmdi03p3fnx176o2jfk58.png
// Recipe:  public.screenshot_recipes where asset_id = '3gyxod5b1f1kmdi03p3fnx176o2jfk58'
// All work opened with the JQL query "created >= -30d", then switched to the Basic view, which shows the query as a
// Created filter. Nothing is saved. Results and recent sidebar items change over time, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { fakeNames, spotlightAreas } from "../lib/tweaks";
import { jiraPeopleTweaks } from "../lib/b2-jira";
import { openJql, sidebarRecent } from "../lib/b3-jsearch";

const JQL = "created >= -30d order by created DESC";
const basic = (page: Page) => page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.basic"]');
const ai = (page: Page) => page.getByRole("button", { name: /^(Ask )?AI$/ }).first();
const saveFilter = (page: Page) => page.getByRole("button", { name: "Save filter" }).or(page.getByRole("link", { name: "Save filter" })).first();
const createdChip = (page: Page) => page.locator("button:visible", { hasText: /^Created:/ }).first();

runRecipe({
  file: "AUC-1701-4",
  assetId: "3gyxod5b1f1kmdi03p3fnx176o2jfk58",
  title: "AUC-1701 #4 - Basic view with a Created filter",
  product: "jira",

  async navigate(page, s) {
    await openJql(page, s, JQL);
    await basic(page).click();
    await createdChip(page).waitFor({ timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await fakeNames(page, "Employee");
    // The whole filter bar, from Ask AI to Save filter (it wraps onto two lines)
    const parts = [ai(page), createdChip(page), saveFilter(page), page.locator("button:visible", { hasText: /^Status$/ }).first()];
    const visible = [];
    for (const p of parts) if (await p.isVisible().catch(() => false)) visible.push(p);
    await spotlightAreas(page, [visible]);
  },

  mask: (page) => [page.locator("table tbody"), page.getByText(/^\d+ of \d+\+?$/), ...sidebarRecent(page)],

  async checks(page, c) {
    await c.check("Page 'All work' in the Basic view", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const on = (await basic(page).getAttribute("aria-checked")) ?? (await basic(page).getAttribute("aria-pressed"));
      return { pass: h1 === "All work" && on === "true", detail: `"${h1}"; Basic selected: ${on}` };
    });

    await c.check("Filter 'Created: Within the last 30 days' with a remove (x) button", async () => {
      const t = (await createdChip(page).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      const lesson = /Created: Within the last 30 days/.test(t);
      return { pass: lesson, detail: lesson ? `"${t}"` : `UI change: the filter reads "${t}" (lesson: "Created: Within the last 30 days")` };
    });

    await c.check("Basic filters: Ask AI, Basic/JQL, Search work items, Space, Assignee, Type, Status, More filters, Clear filters, Save filter", async () => {
      const text = await page.locator("#unsafe-design-system-page-layout-root").innerText();
      const missing = ["Basic", "JQL", "Space", "Assignee", "Type", "Status", "More filters", "Clear filters", "Save filter"].filter((t) => !text.includes(t));
      const search = await page.getByPlaceholder(/Search work/).first().isVisible().catch(() => false);
      const a = await ai(page).isVisible().catch(() => false);
      return { pass: !missing.length && search && a, detail: `Missing: ${missing.join(", ") || "none"}; search box: ${search}; AI: ${a}` };
    });

    await c.check("Header buttons: Apps, Share", async () => {
      const apps = await page.getByRole("button", { name: /^Apps/ }).first().isVisible().catch(() => false);
      const share = await page.getByRole("button", { name: /^Share/ }).first().isVisible().catch(() => false);
      return { pass: apps && share, detail: `Apps: ${apps}; Share: ${share}` };
    });

    await c.check("Results table and count footer", async () => {
      const rows = await page.locator("table tbody tr").count();
      const count = await page.getByText(/^\d+ of \d+\+?$/).first().isVisible().catch(() => false);
      return { pass: rows > 0 && count, detail: `Rows: ${rows} (site data; lesson 23); count footer: ${count}` };
    });
  },
});
