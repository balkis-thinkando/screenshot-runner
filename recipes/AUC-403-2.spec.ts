// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #2, section "Create pages" (the Share dialog with the General access drop-down open: Open and
//          Restricted; dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/6du684118y8c1jw5qdq3aausitxhs25g.png
// Recipe:  public.screenshot_recipes where asset_id = '6du684118y8c1jw5qdq3aausitxhs25g'
// The lesson shows a new page's Share dialog; creating a page is not allowed on the test site, so this opens the
// Share dialog of an existing page (the SyncUp "Engineering onboarding guide") and its General access drop-down.
// No option is picked. Suggested people are fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, hideMessages, renameOrg, spotlight } from "../lib/tweaks";
import { accessOptions, closePopups, fakeShareNames, openGeneralAccess, openPage, shareButton, shareDialog } from "../lib/b3-conf";
import { fakeByline, hideBackToTop } from "../lib/b2-editor";

const option = (page: Page, name: string) => accessOptions(page).getByText(name, { exact: true }).first();

/** Opens the Share dialog (nothing is typed or changed). The "Join your team on Loom" flag that appears after the
 *  page loads is hidden first (display only), and the click is retried once if the dialog does not open. */
async function openShareDialog(page: Page) {
  await hideMessages(page, ["Join your team on Loom"]);
  await closePopups(page);
  const button = shareButton(page);
  await button.waitFor({ timeout: 20_000 });
  await button.click();
  const opened = await shareDialog(page).waitFor({ timeout: 10_000 }).then(() => true, () => false);
  if (!opened) {
    await hideMessages(page, ["Join your team on Loom"]);
    await button.click();
    await shareDialog(page).waitFor({ timeout: 20_000 });
  }
  await page.waitForTimeout(1_500);
}

runRecipe({
  file: "AUC-403-2",
  assetId: "6du684118y8c1jw5qdq3aausitxhs25g",
  title: "AUC-403 #2 - Share dialog General access options",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
    await openShareDialog(page);
    await openGeneralAccess(page);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakeShareNames(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideBackToTop(page);
    await spotlight(page, shareDialog(page).or(accessOptions(page)), { markers: false });
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("General access options: Open (Anyone in this space) and Restricted", async () => {
      const open = await option(page, "Open").isVisible().catch(() => false);
      const restricted = await option(page, "Restricted").isVisible().catch(() => false);
      const text = (await accessOptions(page).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      return { pass: open && restricted, detail: `Options: ${text.slice(0, 200)}` };
    });

    await c.check("Share dialog: name box with suggestions, General access, Copy link, Slack, Public link", async () => {
      const ga = await shareDialog(page).getByText("General access", { exact: true }).isVisible();
      const missing = [];
      for (const b of ["Copy link", "Slack", "Public link"]) if (!(await shareDialog(page).getByText(b, { exact: true }).first().isVisible().catch(() => false))) missing.push(b);
      return { pass: ga && !missing.length, detail: `General access: ${ga}${missing.length ? `; missing: ${missing.join(", ")}` : "; footer buttons present"}` };
    });
  },
});
