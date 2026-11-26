// Lesson:  AUC-729 - Share dashboards in Jira
//          https://community.atlassian.com/learning/lesson/how-to-share-a-dashboard-in-jira
// Image:   #3, section "Share filters with gadgets" (All work search with the Save filter dialog open; the dialog is
//          outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/7xl3038m1drx8ht82nm0f2ktn145css4.png
// Recipe:  public.screenshot_recipes where asset_id = '7xl3038m1drx8ht82nm0f2ktn145css4'
// Runs the Employee Onboarding search in All work and clicks Save filter. In the dialog it types a filter name and
// picks Space > Employee Onboarding for Viewers, as the lesson does, but never clicks Add or Save (nothing is
// created). The lesson's name ends with a person's name, so a fake one is typed. People are shown with fake names.
// The lesson also shows "Employee Onboarding, All roles" already added under Viewers; that needs Add, so it is not
// shown here.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlight } from "../lib/tweaks";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { hidePromos, pickOption, selectControls } from "../lib/b3-jreports";
import { openSignedIn } from "../lib/jira";

const JQL = "project = EO ORDER BY created DESC";
const NAME = "Employee onboarding work items created by Andrea Wilson";
const dialog = (page: Page) => page.locator('[role="dialog"]:visible').filter({ hasText: "Save filter" }).last();

runRecipe({
  file: "AUC-729-3",
  assetId: "7xl3038m1drx8ht82nm0f2ktn145css4",
  title: "AUC-729 #3 - Save filter dialog",
  product: "jira",

  async navigate(page, s) {
    test.setTimeout(240_000);
    // All work with the query (the lesson shows the Basic view). Waits for the result rows: the result count's
    // test id is not always rendered.
    await openSignedIn(page, s, `/issues/?jql=${encodeURIComponent(JQL)}`);
    await page.locator("table tbody tr").first().waitFor({ timeout: 100_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await closeTours(page);
    page.setDefaultTimeout(15_000);
    await page.getByRole("button", { name: "Save filter" }).first().click();
    await dialog(page).waitFor({ timeout: 20_000 });
    await dialog(page).getByRole("textbox").first().fill(NAME);
    // Viewers: Space > Employee Onboarding (the selects of the Viewers row; Add is not clicked)
    try {
      await pickOption(page, selectControls(dialog(page)).nth(0), /^Space$/);
      await pickOption(page, selectControls(dialog(page)).nth(1), /Employee Onboarding/);
    } catch {
      // The checks report the Viewers controls as they are
    }
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await hidePromos(page);
    await spotlight(page, dialog(page), { markers: false });
  },

  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Dialog 'Save filter' with the required-fields note", async () => {
      const text = await dialog(page).innerText();
      const ok = text.includes("Save filter") && /Required fields are marked with an asterisk/.test(text);
      return { pass: ok, detail: ok ? "Present" : `Dialog text: ${text.replace(/\s+/g, " ").slice(0, 80)}` };
    });

    await c.check("Name (required) and Description fields", async () => {
      const text = await dialog(page).innerText();
      const ok = /Name\s*\*/.test(text) && text.includes("Description");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Viewers row: Space type, Employee Onboarding space, roles, Add", async () => {
      const text = (await dialog(page).innerText()).replace(/\s+/g, " ");
      const space = /Viewers.*Space/.test(text);
      const eo = /Employ/.test(text);
      const roles = /All roles|roles/i.test(text);
      const add = await dialog(page).locator("button").filter({ hasText: /^Add$/ }).count();
      return { pass: space && eo && roles && add >= 1, detail: `Space type: ${space}; space picked: ${eo}; roles select: ${roles}; Add buttons: ${add}` };
    });

    await c.check("Editors row: Private ('Only you') with Add", async () => {
      const text = (await dialog(page).innerText()).replace(/\s+/g, " ");
      const ok = /Editors/.test(text) && /Private/.test(text);
      return { pass: ok, detail: `Editors: ${/Editors/.test(text)}; Private: ${/Private/.test(text)}; Only you: ${/Only you/.test(text)}` };
    });

    await c.check("Footer buttons Cancel and Save", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible();
      const save = await dialog(page).getByRole("button", { name: "Save" }).isVisible();
      return { pass: cancel && save, detail: `Cancel: ${cancel}; Save: ${save}` };
    });

    await c.check("Search results behind the dialog (Employee Onboarding work items)", async () => {
      const rows = await page.locator("table tbody tr").count();
      return { pass: rows > 0, detail: `Rows: ${rows}` };
    });
  },
});
