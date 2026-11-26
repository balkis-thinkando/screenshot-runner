// Lesson:  AUC-410 - Manage pages in Confluence
//          https://community.atlassian.com/learning/lesson/manage-pages-in-confluence
// Image:   #2, section "Add labels to pages" (a page in edit mode with the Add labels dialog open: label box and
//          Close button; dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/5ivm336e478p6f7304d5tbd4qpm8uxs4.png
// Recipe:  public.screenshot_recipes where asset_id = '5ivm336e478p6f7304d5tbd4qpm8uxs4'
// The editor no longer offers labels (its More actions menu has no labels item, Nov 2026), so this opens the
// closest screen: the SyncUp "Engineering onboarding guide" in view mode and its "Add labels" button at the end
// of the page, which opens the labels dialog. No label is typed or added.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakeByline, hideBackToTop, hideTooltips } from "../lib/b2-editor";
import { closePopups, fakePeopleLinks, openPage } from "../lib/b3-conf";

const addLabels = (page: Page) => page.getByRole("button", { name: /^Add labels?$/ }).first();
const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /labels?/i }).last();

runRecipe({
  file: "AUC-410-2",
  assetId: "5ivm336e478p6f7304d5tbd4qpm8uxs4",
  title: "AUC-410 #2 - Add labels dialog",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
    await closePopups(page);
    await addLabels(page).scrollIntoViewIfNeeded();
    await addLabels(page).click();
    await dialog(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideTooltips(page);
    await hideBackToTop(page);
    await spotlight(page, dialog(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [page.getByText(/^(Last updated|Published|Edited|Updated) |^Unpublished changes$/).first()],

  async checks(page, c) {
    await c.check("Labels are added from the editor (as in the lesson)", async () => {
      const edit = /\/edit-v2\//.test(page.url());
      return { pass: edit, detail: edit ? "Editor" : "Not in the editor any more: the dialog opens from the 'Add labels' button at the end of the page in view mode" };
    });

    await c.check("Dialog title 'Add labels' with Learn more", async () => {
      const t = (await dialog(page).getByRole("heading").first().innerText().catch(() => "")).trim();
      const learn = await dialog(page).getByText("Learn more").first().isVisible().catch(() => false);
      return { pass: t === "Add labels" && learn, detail: `Title: ${t || "none"}; Learn more: ${learn}` };
    });

    await c.check("Description 'Add or remove labels to help others find your content.'", async () => {
      const v = await dialog(page).getByText(/Add or remove labels/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : `Missing. Dialog text: ${(await dialog(page).innerText()).replace(/\s+/g, " ").slice(0, 150)}` };
    });

    await c.check("Add label box", async () => {
      const v = await dialog(page).getByText(/Add label/).or(dialog(page).getByRole("combobox")).or(dialog(page).getByRole("textbox")).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Close button", async () => {
      const v = await dialog(page).getByRole("button", { name: "Close", exact: true }).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
