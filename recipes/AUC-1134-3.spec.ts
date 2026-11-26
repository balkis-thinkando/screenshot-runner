// Lesson:  AUC-1134 - Determine what displays on a Jira board using filters
//          https://community.atlassian.com/learning/lesson/filter-jira-board
// Image:   #3, section "Manage who can view company-managed board filters" (Edit filter dialog of a board's saved
//          filter, outlined, with markers on Name, Description, Viewers and Editors)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT129O.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT129O'
// The lesson edits "Filter for PLAT board", which the test account cannot edit (it gets Copy filter only). This uses
// "MOBL Baltimore" (filter 10007), the saved filter of the MOBL Baltimore board, which the account can edit:
// Filter details > Edit Permissions opens the Edit filter dialog. Nothing is changed and Save is never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { markers, spotlight } from "../lib/tweaks";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { hideSidebarAd } from "../lib/b3-jboards";

const FILTER_ID = 10007;
const FILTER_NAME = "MOBL Baltimore";
const dialog = (page: Page) => page.locator('[data-testid="modal-dialog"]').filter({ hasText: "Edit filter" });
const label = (page: Page, t: string) => dialog(page).locator("label, h2, h3, h4, div, span").filter({ hasText: new RegExp(`^${t}\\s*\\*?$`) }).last();

runRecipe({
  file: "AUC-1134-3",
  assetId: "AT129O",
  title: "AUC-1134 #3 - Edit filter dialog",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, `/issues/?filter=${FILTER_ID}`);
    const details = page.locator('[data-testid="custom-filters.ui.details-popup.button"]');
    await details.waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await closeTours(page);
    await details.click();
    await page.getByRole("button", { name: "Edit Permissions" }).click();
    await dialog(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideSidebarAd(page);
    await jiraPeopleTweaks(page, s);
    await spotlight(page, dialog(page), { markers: false });
    const labels = page.locator("[data-jb-label]");
    await dialog(page).evaluate((d) => {
      for (const t of ["Name", "Description", "Viewers", "Editors"]) {
        const el = Array.from(d.querySelectorAll<HTMLElement>("label, div, span, h3, h4")).find((e) => e.children.length <= 1 && new RegExp(`^${t}\\s*\\*?$`).test(e.innerText.trim()));
        el?.setAttribute("data-jb-label", t);
      }
    });
    await markers(page, labels, "left", [110]);
  },

  async checks(page, c) {
    await c.check("Edit filter dialog open for the board's filter", async () => {
      const open = await dialog(page).isVisible().catch(() => false);
      const name = await dialog(page).locator('[data-testid="shareable-entity-dialog.text-field"]').inputValue().catch(() => "");
      return { pass: open && name === FILTER_NAME, detail: `Dialog: ${open}; Name field: "${name}"` };
    });

    await c.check("Fields: Name (required), Description, Viewers, Editors", async () => {
      const missing: string[] = [];
      for (const t of ["Name", "Description", "Viewers", "Editors"]) if (!(await label(page, t).isVisible().catch(() => false))) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Viewers and Editors each have a type picker, a second picker and an Add button", async () => {
      const adds = await dialog(page).locator("button").filter({ hasText: /^\s*Add\s*$/ }).count();
      const text = await dialog(page).innerText();
      const group = /Group/.test(text);
      return { pass: adds >= 2 && group, detail: `Add buttons: ${adds}; Group picker: ${group}` };
    });

    await c.check("Current viewers and editors listed with remove (x) buttons", async () => {
      const rows = await dialog(page).locator('[data-testid*="sharee-list-row"]').count();
      const text = await dialog(page).innerText();
      const admins = text.includes("site-admins");
      return { pass: rows >= 1 && admins, detail: `${rows} sharee rows; site-admins editor: ${admins}` };
    });

    await c.check("Cancel and Save buttons", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible();
      const save = await dialog(page).getByRole("button", { name: "Save" }).isVisible();
      return { pass: cancel && save, detail: `Cancel: ${cancel}; Save: ${save}` };
    });
  },
});
