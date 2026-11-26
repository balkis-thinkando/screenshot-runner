// Lesson:  AUC-1402 - Change the look and feel of a Confluence space
//          https://community.atlassian.com/learning/lesson/change-the-look-and-feel-of-a-confluence-space
// Image:   #4, section "Add headers and footers to fit your needs" (Space settings > Look and feel > Layout:
//          the Layout link and the Header and Footer boxes outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/12t8um06n0c0308sr833u6h8qev7610b.png
// Recipe:  public.screenshot_recipes where asset_id = '12t8um06n0c0308sr833u6h8qev7610b'
// Opens the Layout page of the SyncUp space settings (the lesson uses a Marketing space). Nothing is typed or saved.

import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, expandNavGroup, heading, itemTexts, missingFrom, navLink, openSpaceSettings, settingsNav } from "../lib/b3-conf";
import { Page } from "@playwright/test";

const main = (page: Page) => page.locator("#AkMainContent");
const header = (page: Page) => main(page).getByRole("textbox").nth(0);
const footer = (page: Page) => main(page).getByRole("textbox").nth(1);
/** The header and footer block: from its heading to its buttons. */
const block = (page: Page) => [
  main(page).getByText("Custom header or footer", { exact: true }).or(main(page).getByText(/Customize the look of all pages/)).first(),
  footer(page),
  main(page).getByRole("button", { name: "Discard changes" }),
];

runRecipe({
  file: "AUC-1402-4",
  assetId: "12t8um06n0c0308sr833u6h8qev7610b",
  title: "AUC-1402 #4 - Space layout header and footer",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceSettings(page, s, "look-and-feel/page-layout", "Layout");
    await expandNavGroup(page, "Look and feel");
    // The lesson shows the header and footer boxes; on a short window they sit below the density setting
    await main(page).getByRole("button", { name: "Discard changes" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await dimAreas(page, [navLink(page, "Layout"), block(page)]);
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Look and feel group: Themes, Templates, Layout, PDF export", async () => {
      const links = await itemTexts(settingsNav(page).getByRole("link"));
      const missing = missingFrom(links, ["Themes", "Templates", "Layout", "PDF export"]);
      return { pass: !missing.length, detail: `Links: ${links.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Layout page shows only the header and footer setting", async () => {
      const density = await main(page).getByText("Content density", { exact: true }).isVisible().catch(() => false);
      return { pass: !density, detail: density ? "Now also has a 'Content density' setting (Standard / Compact) above a 'Custom header or footer' section" : "Header and footer only" };
    });

    await c.check("Header and Footer boxes", async () => {
      const h = await main(page).getByText("Header", { exact: true }).isVisible();
      const f = await main(page).getByText("Footer", { exact: true }).isVisible();
      const boxes = await main(page).getByRole("textbox").count();
      return { pass: h && f && boxes >= 2, detail: `Header: ${h}; Footer: ${f}; text boxes: ${boxes}` };
    });

    await c.check("Wiki markup description", async () => {
      const t = await main(page).getByText(/Customize the look of all pages/).first().isVisible();
      return { pass: t, detail: t ? "Present" : "Missing" };
    });

    await c.check("Save and Discard changes buttons", async () => {
      const save = await main(page).getByRole("button", { name: "Save" }).last().isVisible();
      const discard = await main(page).getByRole("button", { name: "Discard changes" }).isVisible();
      return { pass: save && discard, detail: `Save: ${save}; Discard changes: ${discard}` };
    });
  },
});
