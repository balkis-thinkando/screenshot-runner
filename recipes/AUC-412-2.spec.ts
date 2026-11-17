// Lesson:  AUC-412 - Search for information in Confluence
//          https://community.atlassian.com/learning/lesson/search-in-confluence
// Image:   #2, section "Use advanced search": full search results for "marketing", with the filter bar
//          (App, Last updated, Type, Contributor, Suggested: Space) and the app panel on the right outlined
//          https://dam-cdn.atl.orangelogic.com/AssetLink/dvfnf68u67m0h0j13o6457h2q146ybon.png
// Recipe:  public.screenshot_recipes where asset_id = 'dvfnf68u67m0h0j13o6457h2q146ybon'
// Opens the search page for "marketing". At 1280px the Last updated, Type and Contributor filters sit in the
// "More filters" menu, so the recipe opens it (display only, no filter is applied) and outlines the filter bar
// and that menu. Results are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { fakePersonalSpaces, markResultsArea, openSearchPage, searchInput } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const QUERY = "marketing";
const moreFilters = (page: Page) => page.getByTestId("dropdown-filter-button");
// The filter bar: from the app tabs to the Suggested space filter
const filterBar = (page: Page) =>
  page.locator("div").filter({ has: page.getByTestId("filter-all") }).filter({ has: page.getByTestId("search-dialog-space-filter-button") }).last();
// The More filters menu, found from its "Last updated" filter
const filterMenu = (page: Page) =>
  page.locator("div").filter({ has: page.getByText("Last updated", { exact: true }).locator("visible=true") }).filter({ has: page.getByText("Contributor", { exact: true }).locator("visible=true") }).filter({ hasNot: page.getByTestId("filter-all") }).last();

runRecipe({
  file: "AUC-412-2",
  assetId: "dvfnf68u67m0h0j13o6457h2q146ybon",
  title: "AUC-412 #2 - Advanced search filters",
  product: "confluence",

  async navigate(page, s) {
    await openSearchPage(page, s, QUERY);
    await page.getByRole("link", { name: /marketing/i }).or(page.getByText(/\bmarketing\b/i)).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await moreFilters(page).click();
    await filterMenu(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakePersonalSpaces(page);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await markResultsArea(page, filterBar(page));
    // The filter buttons (not the whole bar, whose box would overlap the menu) and the More filters menu
    await spotlightAreas(page, [[page.getByTestId("filter-all"), page.getByTestId("search-dialog-space-filter-button")], filterMenu(page)]);
  },

  // Which pages match "marketing", their snippets and update times change over time
  mask: (page) => [page.locator('[data-screenshot-mask="results"]')],

  async checks(page, c) {
    await c.check("Search bar shows 'marketing'", async () => {
      const v = await searchInput(page).inputValue();
      return { pass: v === QUERY, detail: `"${v}"` };
    });

    await c.check("App filter: All, Confluence, Jira", async () => {
      const tabs = await Promise.all(["filter-all", "filter-confluence", "filter-jira"].map((id) => page.getByTestId(id).isVisible()));
      return { pass: tabs.every(Boolean), detail: `All/Confluence/Jira: ${tabs.join("/")} (now app tabs above the results; lesson: App drop-down)` };
    });

    await c.check("Filters: Last updated, Type, Contributor", async () => {
      const menu = filterMenu(page);
      const found = await Promise.all(["Last updated", "Type", "Contributor"].map((t) => menu.getByText(t, { exact: true }).isVisible().catch(() => false)));
      return { pass: found.every(Boolean), detail: `Last updated/Type/Contributor: ${found.join("/")} (in the More filters menu at 1280px)` };
    });

    await c.check("Suggested: Space filter", async () => {
      const sug = await page.getByText("Suggested:", { exact: true }).isVisible();
      const space = await page.getByTestId("search-dialog-space-filter-button").isVisible();
      return { pass: sug && space, detail: `Suggested label: ${sug}; Space: ${space}` };
    });

    await c.check("App panel on the right with result counts, Projects and Goals", async () => {
      const goals = await page.getByText("Goals", { exact: true }).first().isVisible().catch(() => false);
      const projects = await page.getByText("Projects", { exact: true }).first().isVisible().catch(() => false);
      return {
        pass: goals && projects,
        detail: goals && projects ? "Present" : "Not shown: the right-hand app panel (All, Confluence, Jira with counts, Projects, Goals) is replaced by app tabs above the results, without counts",
      };
    });

    await c.check("Results list pages that match 'marketing'", async () => {
      const text = await page.locator("#AkMainContent").innerText();
      const hits = (text.match(/\bmarketing\b/gi) ?? []).length;
      const pages = (text.match(/Confluence\s*•\s*Page/g) ?? []).length;
      return { pass: pages >= 3 && hits >= 1, detail: `${pages} page results; "marketing" appears ${hits} times` };
    });
  },
});
