// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #1, section "Create pages" (space home: the top Create button and the sidebar Content "+" outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/82q4636c4yf2xd12u64uoqg764675psp.png
// Recipe:  public.screenshot_recipes where asset_id = '82q4636c4yf2xd12u64uoqg764675psp'
// Opens the SyncUp space home (the lesson uses a Marketing space). Neither Create button is clicked (both create
// a draft right away). The Content "+" only shows on hover in the sidebar, so the mouse rests on the Content row.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { contentCreateButton, dimAreas, markContentCreate, fakePeopleLinks, openSpaceHome, sideRow, topCreateButton } from "../lib/b3-conf";

const topCreate = (page: Page) => page.locator('[data-screenshot-area="top-create"]');

runRecipe({
  file: "AUC-403-1",
  assetId: "82q4636c4yf2xd12u64uoqg764675psp",
  title: "AUC-403 #1 - Create buttons on the space home",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceHome(page, s);
  },

  async tweak(page, s) {
    await topCreateButton(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await sideRow(page, "Content").hover();
    await page.waitForTimeout(800);
    await markContentCreate(page);
    await dimAreas(page, [topCreate(page), contentCreateButton(page)]);
  },

  // Recent updates and page content change
  mask: (page) => [page.locator("#AkMainContent")],

  async checks(page, c) {
    await c.check("Create button in the top bar", async () => {
      const v = await topCreate(page).isVisible();
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Content row with a + (Create) button in the space sidebar", async () => {
      const row = await sideRow(page, "Content").isVisible();
      const plus = await contentCreateButton(page).isVisible();
      return { pass: row && plus, detail: `Content: ${row}; +: ${plus}` };
    });

    await c.check("Sidebar: Shortcuts above Content", async () => {
      const s = await sideRow(page, "Shortcuts").boundingBox();
      const c2 = await sideRow(page, "Content").boundingBox();
      const ok = !!s && !!c2 && s.y < c2.y;
      return { pass: ok, detail: ok ? "Shortcuts, then Content" : `Shortcuts: ${!!s}; Content: ${!!c2}` };
    });
  },
});
