// Lesson:  AUC-410 - Manage pages in Confluence
//          https://community.atlassian.com/learning/lesson/manage-pages-in-confluence
// Image:   #4, section "Inspect page permissions" (page view, the Share dialog with its ••• menu open:
//          Inspect permissions, Learn more about restrictions, Give feedback; dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/oxmodhu35moul14kxkc7u0l1l8o6qm45.png
// Recipe:  public.screenshot_recipes where asset_id = 'oxmodhu35moul14kxkc7u0l1l8o6qm45'
// Opens the SyncUp "Engineering onboarding guide", its Share dialog and the dialog's ••• menu. Nothing is typed,
// shared or changed. Suggested people under the name box are fake names. Sidebar hidden display-only as in the
// lesson.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar } from "../lib/confluence";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { closePopups, fakeShareNames, itemTexts, missingFrom, openPage, shareDialog } from "../lib/b3-conf";
import { fakeByline, hideBackToTop } from "../lib/b2-editor";

const moreMenu = (page: Page) => page.getByRole("menu").filter({ has: page.getByRole("menuitem", { name: /Inspect permissions/ }) }).last();

/** The page header's Share button (its name now includes the access level: "Share, Open - ..."). */
const shareButton = (page: Page) => page.getByRole("main").getByRole("button", { name: /^Share\b/ }).first();

/** Opens the Share dialog (nothing is typed or changed). A click made while the page is still settling can be lost,
 *  so the button is clicked again until the dialog shows. */
async function openShareDialog(page: Page) {
  await closePopups(page);
  await shareButton(page).waitFor({ timeout: 30_000 });
  for (let i = 0; i < 3; i++) {
    if (await shareDialog(page).isVisible().catch(() => false)) break;
    await shareButton(page).click();
    const opened = await shareDialog(page).waitFor({ timeout: 10_000 }).then(() => true, () => false);
    if (opened) break;
    // A flag or late render may have taken the click: clear it and try again
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2_000);
  }
  await shareDialog(page).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
}

runRecipe({
  file: "AUC-410-4",
  assetId: "oxmodhu35moul14kxkc7u0l1l8o6qm45",
  title: "AUC-410 #4 - Share dialog Inspect permissions",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
    await hideSidebar(page);
    await openShareDialog(page);
    await shareDialog(page).getByRole("button", { name: /^(More|More actions|More options|Show more)$/ }).last().click();
    await moreMenu(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakeShareNames(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideBackToTop(page);
    await spotlight(page, [shareDialog(page), moreMenu(page)].reduce((a, b) => a.or(b)), { markers: false });
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("••• menu: Inspect permissions, Learn more about restrictions, Give feedback", async () => {
      const have = await itemTexts(moreMenu(page).getByRole("menuitem"));
      const missing = missingFrom(have, ["Inspect permissions", "Learn more about restrictions", "Give feedback"]);
      return { pass: !missing.length, detail: `Items: ${have.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Share dialog: name box, General access, Copy link", async () => {
      const box = await shareDialog(page).getByRole("combobox").or(shareDialog(page).getByPlaceholder(/names, groups/)).first().isVisible().catch(() => false);
      const ga = await shareDialog(page).getByText("General access", { exact: true }).isVisible();
      const copy = await shareDialog(page).getByRole("button", { name: /Copy link/ }).first().isVisible().catch(() => false);
      return { pass: box && ga && copy, detail: `Name box: ${box}; General access: ${ga}; Copy link: ${copy}` };
    });
  },
});
