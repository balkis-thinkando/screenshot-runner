// Lesson:  AUC-729 - Share dashboards in Jira
//          https://community.atlassian.com/learning/lesson/how-to-share-a-dashboard-in-jira
// Image:   #1, section "Share a dashboard" (Rename or share dashboard dialog with viewers and editors; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/5vp477d7i5p880085p8dwn5mmtpq38o6.png
// Recipe:  public.screenshot_recipes where asset_id = '5vp477d7i5p880085p8dwn5mmtpq38o6'
// Stand-in: the lesson's "HR - Human Resources" dashboard does not exist on the test site, and the test account owns
// or edits no dashboard, so it has no "Rename or share" action anywhere. The only sharing dialog it can open is
// "Share dashboard" for the Default dashboard (from Dashboards > More actions), which this recipe opens. Nothing is
// changed and the dialog is left open (never saved). Needs test data for the lesson's screen: a dashboard the test
// account owns.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { basicTweaks, fakeListedPeople, openPage } from "../lib/b3-jreports";

const DASHBOARD = "Default dashboard";
const dialog = (page: Page) => page.locator('[role="dialog"]:visible').last();

runRecipe({
  file: "AUC-729-1",
  assetId: "5vp477d7i5p880085p8dwn5mmtpq38o6",
  title: "AUC-729 #1 - Share dashboard dialog",
  product: "jira",

  async navigate(page, s) {
    await openPage(page, s, "/jira/dashboards", (p) => p.getByRole("heading", { name: "Dashboards", exact: true }), "Dashboards directory");
    await page.getByRole("button", { name: `More actions for ${DASHBOARD}` }).first().click();
    const items = page.locator('[role="menuitem"]:visible');
    await items.first().waitFor({ timeout: 15_000 });
    const share = items.filter({ hasText: /^(Rename or share|Share dashboard)/ }).first();
    if (!(await share.isVisible().catch(() => false))) throw new Error(`No share action for ${DASHBOARD}: ${(await items.allInnerTexts()).join(", ")}`);
    await share.click();
    await dialog(page).getByText(/Viewers/).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeListedPeople(page.locator("table"));
    await fakeListedPeople(dialog(page));
    await basicTweaks(page, s);
  },

  mask: (page) => [page.locator('[data-testid="page-layout.main"] table tbody')],

  async checks(page, c) {
    await c.check("Dialog title 'Rename or share dashboard'", async () => {
      const h = (await dialog(page).locator("h1, h2").first().innerText().catch(() => "")).trim();
      return { pass: h === "Rename or share dashboard", detail: h === "Rename or share dashboard" ? "Present" : `Test data: the account owns no dashboard; the dialog opened is "${h}"` };
    });

    await c.check("Name and Description fields", async () => {
      const text = await dialog(page).innerText();
      const ok = /\bName\b/.test(text) && /\bDescription\b/.test(text);
      return { pass: ok, detail: ok ? "Present" : "Missing (the Share dashboard dialog has no name or description; needs an owned dashboard)" };
    });

    await c.check("Viewers: type dropdown, Select space, Add, and the current viewers", async () => {
      const text = await dialog(page).innerText();
      const ok = text.includes("Viewers");
      const add = await dialog(page).locator("button").filter({ hasText: /^Add$/ }).count();
      return { pass: ok && add >= 1, detail: `${add ? "" : "Test data (Default dashboard's dialog has only a Public/organization choice with Update): "}Viewers section: ${ok}; Add buttons: ${add}` };
    });

    await c.check("Editors section with its own Add button", async () => {
      const text = await dialog(page).innerText();
      const ok = text.includes("Editors");
      const add = await dialog(page).locator("button").filter({ hasText: /^Add$/ }).count();
      return { pass: ok && add >= 2, detail: `${ok ? "" : "Test data (the Default dashboard has no editors section): "}Editors section: ${ok}; Add buttons: ${add}` };
    });

    await c.check("Footer buttons Cancel and Save", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible();
      const save = await dialog(page).getByRole("button", { name: "Save" }).isVisible();
      return { pass: cancel && save, detail: `Cancel: ${cancel}; Save: ${save}` };
    });
  },
});
