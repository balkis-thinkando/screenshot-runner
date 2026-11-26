// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #8, section "Publish and update pages" (edit mode, the Update page dialog from the arrow next to
//          Update: Location, General access, Notify watchers, Version comments, Schedule update, Update as;
//          outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/r83754t65v070d4r2ak7c1h420x487ja.png
// Recipe:  public.screenshot_recipes where asset_id = 'r83754t65v070d4r2ak7c1h420x487ja'
// Opens the editor of the SyncUp "Engineering onboarding guide", clicks the arrow next to Update and its
// "Adjust update settings" item, which opens the dialog. Nothing is typed; neither Update, Preview nor "Update
// without notifying watchers" is clicked. The test closes the browser, leaving the page unchanged.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakeByline, hideBackToTop, hideTooltips, openEditor } from "../lib/b2-editor";
import { updateChevron, updateDialog } from "../lib/b3-conf";

const has = (page: Page, text: string | RegExp) => updateDialog(page).getByText(text).first().isVisible().catch(() => false);

runRecipe({
  file: "AUC-403-8",
  assetId: "r83754t65v070d4r2ak7c1h420x487ja",
  title: "AUC-403 #8 - Update page dialog",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
    await updateChevron(page).click();
    // The arrow opens a short menu: "Update without notifying watchers" (publishes: never clicked) and
    // "Adjust update settings" (opens the dialog)
    const item = page.getByRole("menuitem", { name: /^Adjust update settings$/ }).first();
    await item.waitFor({ timeout: 10_000 });
    await item.click();
    await updateDialog(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideTooltips(page);
    await hideBackToTop(page);
    await spotlight(page, updateDialog(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Dialog title 'Update page'", async () => {
      const v = await updateDialog(page).getByRole("heading", { name: /Update page/ }).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : `Title now: ${(await updateDialog(page).getByRole("heading").first().innerText().catch(() => "none")).trim()}` };
    });

    await c.check("Location and General access", async () => {
      const loc = await has(page, "Location");
      const ga = await has(page, "General access");
      return { pass: loc && ga, detail: `Location: ${loc}; General access: ${ga}` };
    });

    await c.check("Notify watchers via email checkbox", async () => {
      const v = await has(page, /Notify watchers/);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Version comments box", async () => {
      const v = await has(page, "Version comments");
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Schedule update (Immediately) and Update as (Page)", async () => {
      const sched = await has(page, /Schedule/);
      const as = await has(page, /Update as/);
      return { pass: sched && as, detail: `Schedule update: ${sched}; Update as: ${as}` };
    });

    await c.check("Preview and Update buttons", async () => {
      const prev = await updateDialog(page).getByRole("button", { name: "Preview" }).isVisible().catch(() => false);
      const upd = await updateDialog(page).getByRole("button", { name: /^Update$/ }).isVisible().catch(() => false);
      return { pass: prev && upd, detail: `Preview: ${prev}; Update: ${upd}` };
    });
  },
});
