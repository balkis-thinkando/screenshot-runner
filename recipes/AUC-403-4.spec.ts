// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #4, section "Collaborate in real time with live docs" (page view, the top Create menu open: Live Doc
//          (NEW, outlined), Page, Whiteboard, Database, Blog, Smart Link, Space, Loom video)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2a8pm3sbu4p2f74am41wk72b4bm5fti5.png
// Recipe:  public.screenshot_recipes where asset_id = '2a8pm3sbu4p2f74am41wk72b4bm5fti5'
// NOT the lesson's end state: the top Create button may create a draft as soon as it is clicked, which is not
// allowed on the test site, so the menu is not opened. The recipe opens the SyncUp "Engineering onboarding guide"
// and outlines the Create button; the menu check fails until a safe way to open the menu is confirmed.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakePeopleLinks, openPage, topCreateButton } from "../lib/b3-conf";
import { fakeByline, hideBackToTop } from "../lib/b2-editor";

const topCreate = (page: Page) => page.locator('[data-screenshot-area="top-create"]');

runRecipe({
  file: "AUC-403-4",
  assetId: "2a8pm3sbu4p2f74am41wk72b4bm5fti5",
  title: "AUC-403 #4 - Create menu with Live Doc",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
  },

  async tweak(page, s) {
    await topCreateButton(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideBackToTop(page);
    await spotlight(page, topCreate(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [page.getByText(/^(Last updated|Published|Edited|Updated) |^Unpublished changes$/).first(), page.locator('[data-testid="badge-style-analytics-byline"]')],

  async checks(page, c) {
    await c.check("Create button in the top bar", async () => {
      const v = await topCreate(page).isVisible();
      const popup = await topCreate(page).getAttribute("aria-haspopup");
      return { pass: v, detail: v ? `Present (opens a menu: ${popup ?? "not announced"})` : "Missing" };
    });

    await c.check("Create menu: Live Doc (NEW), Page, Whiteboard, Database, Blog, Smart Link, Space", async () => ({
      pass: false,
      detail: "Not checked: the Create menu is not opened on the test site (clicking Create may create a draft)",
    }));
  },
});
