// Lesson:  AUC-412 - Search for information in Confluence
//          https://community.atlassian.com/learning/lesson/search-in-confluence
// Image:   #1, section "Use the search bar": "marketing" typed in the search bar (not submitted) and the
//          drop-down of matching pages and spaces (drop-down outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/65hnirs22c32y0w7s720b8c7638nf7x4.png
// Recipe:  public.screenshot_recipes where asset_id = '65hnirs22c32y0w7s720b8c7638nf7x4'
// Opens Confluence home, clicks the search bar and types "marketing" without pressing Enter. The lesson's
// "Recent" group depends on the account's history, so it is not checked; the results list is masked.

import { runRecipe } from "../lib/recipe";
import { fakePersonalSpaces, keepTeamIcons, markResultsArea, openWiki, searchDialog, searchInput } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const QUERY = "marketing";

runRecipe({
  file: "AUC-412-1",
  assetId: "65hnirs22c32y0w7s720b8c7638nf7x4",
  title: "AUC-412 #1 - Search bar drop-down",
  product: "confluence",

  async navigate(page, s) {
    await openWiki(page, s, "/home", searchInput(page), "Confluence home");
    await searchInput(page).click();
    await page.keyboard.type(QUERY, { delay: 60 });
    await searchDialog(page).getByText(/^Search results$/i).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakePersonalSpaces(page);
    await fakeProfileNames(page);
    await keepTeamIcons(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    // The home page behind the drop-down shows recently visited pages
    await markResultsArea(page, searchDialog(page), "home");
    await spotlight(page, page.locator('[data-testid="search-dialog"], [data-testid="search-input"]'), { markers: false });
  },

  // Which pages match, and when they were updated, changes over time; so do the recent pages behind the drop-down
  mask: (page) => [searchDialog(page).getByRole("listbox"), page.locator('[data-screenshot-mask="home"]')],

  async checks(page, c) {
    await c.check("Search bar shows the typed text 'marketing'", async () => {
      const v = await searchInput(page).inputValue();
      return { pass: v === QUERY, detail: `"${v}"` };
    });

    await c.check("Drop-down filters: Space and Contributor (plus App, filter button)", async () => {
      const t = await searchDialog(page).innerText();
      const has = (w: string) => new RegExp(`(^|\\n)\\s*${w}\\s*(\\n|$)`).test(t);
      const space = has("Space");
      const contrib = has("Contributor");
      const app = has("App");
      return { pass: space && contrib, detail: `Space: ${space}; Contributor: ${contrib}; App: ${app}` };
    });

    await c.check("Search results group lists matching pages and a space or team", async () => {
      const rows = await searchDialog(page).getByRole("listbox").locator("a, [role=option]").count();
      const kinds = await searchDialog(page).getByRole("listbox").innerText();
      const page_ = /\bPage\b/.test(kinds);
      const spaceOrTeam = /(^|\n)\s*(Space|Team)\s*(\n|$)/.test(kinds);
      return { pass: rows >= 3 && page_, detail: `${rows} results; pages: ${page_}; space or team result: ${spaceOrTeam}` };
    });

    await c.check("Footer: 'Search all apps' and 'Give feedback'", async () => {
      const all = await searchDialog(page).getByText("Search all apps").isVisible();
      const fb = await searchDialog(page).getByText("Give feedback").isVisible();
      return { pass: all && fb, detail: `Search all apps: ${all}; Give feedback: ${fb}` };
    });
  },
});
