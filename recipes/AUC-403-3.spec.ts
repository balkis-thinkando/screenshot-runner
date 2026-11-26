// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #3, section "Create pages" (page view, the sidebar More menu open: Drafts, Tasks, Templates, Customize
//          sidebar; outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/8465ip8fjex66twt7148866qimir8a12.png
// Recipe:  public.screenshot_recipes where asset_id = '8465ip8fjex66twt7148866qimir8a12'
// Opens the SyncUp "Engineering onboarding guide" (the lesson uses a Marketing page) and the sidebar's More menu.
// No item is clicked. Names in the byline are fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakePeopleLinks, itemTexts, missingFrom, openPage, sideNav } from "../lib/b3-conf";
import { fakeByline, hideBackToTop } from "../lib/b2-editor";

const moreButton = (page: Page) => sideNav(page).getByRole("button", { name: /^More$/ }).last();
/** The menu opens in a pop-up container without a menu role: the innermost box with Drafts and Customize sidebar. */
const moreMenu = (page: Page) =>
  page
    .locator("div, section, nav")
    .filter({ has: page.getByRole("link", { name: "Drafts", exact: true }) })
    .filter({ has: page.getByRole("button", { name: /Customi[sz]e sidebar/ }) })
    .last();

runRecipe({
  file: "AUC-403-3",
  assetId: "8465ip8fjex66twt7148866qimir8a12",
  title: "AUC-403 #3 - Sidebar More menu",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
    await moreButton(page).click();
    await moreMenu(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideBackToTop(page);
    await spotlight(page, moreButton(page).or(moreMenu(page)), { markers: false });
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [page.getByText(/^(Last updated|Published|Edited|Updated) |^Unpublished changes$/).first(), page.locator('[data-testid="badge-style-analytics-byline"]')],

  async checks(page, c) {
    await c.check("More menu: Drafts, Tasks, Templates, Customize sidebar", async () => {
      const have = await itemTexts(moreMenu(page).locator('[role="menuitem"], a, button'));
      // (Drafts, Tasks and Templates are links, Customize sidebar a button)
      const missing = missingFrom(have, ["Drafts", "Tasks", "Templates", "Customize sidebar"]);
      return { pass: !missing.length, detail: `Items: ${have.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });
  },
});
