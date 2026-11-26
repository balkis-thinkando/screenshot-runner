// Lesson:  AUC-1402 - Change the look and feel of a Confluence space
//          https://community.atlassian.com/learning/lesson/change-the-look-and-feel-of-a-confluence-space
// Image:   #3, section "Enhance navigation with shortcuts" (space home, the sidebar Shortcuts row and its add-link
//          pop-up outlined: link box, display text box, recently viewed pages)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ocyth8sfwff16a4g701u84xyj4bjegq7.png
// Recipe:  public.screenshot_recipes where asset_id = 'ocyth8sfwff16a4g701u84xyj4bjegq7'
// Opens the SyncUp space home and clicks the Shortcuts "+" (Add shortcut). Nothing is typed or added. The
// recently viewed list depends on the account's history, so it is masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, fakePeopleLinks, openSpaceHome, sideNav, sideRow } from "../lib/b3-conf";

const addButton = (page: Page) => sideNav(page).getByRole("button", { name: "Add shortcut", exact: true }).first();
const popup = (page: Page) => page.locator('[role="dialog"], [data-testid*="popup"], [data-testid*="link-picker"]').filter({ has: page.getByRole("textbox") }).last();
const linkBox = (page: Page) => popup(page).getByRole("textbox").or(popup(page).getByRole("combobox")).first();

runRecipe({
  file: "AUC-1402-3",
  assetId: "ocyth8sfwff16a4g701u84xyj4bjegq7",
  title: "AUC-1402 #3 - Add shortcut pop-up",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceHome(page, s);
    await sideRow(page, "Shortcuts").hover();
    await addButton(page).click();
    await popup(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await dimAreas(page, [sideRow(page, "Shortcuts"), popup(page)]);
  },

  mask: (page) => [popup(page).getByRole("listbox").or(popup(page).locator('[role="list"]')).first(), page.locator("#AkMainContent")],

  async checks(page, c) {
    await c.check("Pop-up: 'Search or paste a link' box (required)", async () => {
      const t = await popup(page).innerText();
      const label = /Search or paste a link/.test(t);
      const box = await linkBox(page).isVisible();
      return { pass: label && box, detail: `Label: ${label}; box: ${box}` };
    });

    await c.check("Pop-up: 'Display text (optional)' box", async () => {
      const t = await popup(page).innerText();
      const label = /Display text/.test(t);
      const boxes = (await popup(page).getByRole("textbox").count()) + (await popup(page).getByRole("combobox").count());
      return { pass: label && boxes >= 2, detail: `Label: ${label}; text boxes: ${boxes}` };
    });

    await c.check("Pop-up lists recently viewed pages", async () => {
      const t = await popup(page).innerText();
      const recent = /Recently viewed/i.test(t);
      return { pass: recent, detail: recent ? "Recently viewed list shown" : `No recently viewed list. Pop-up text starts: ${t.replace(/\s+/g, " ").slice(0, 120)}` };
    });
  },
});
