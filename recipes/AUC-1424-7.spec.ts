// Lesson:  AUC-1424 - Use page templates in your Confluence space
//          https://community.atlassian.com/learning/lesson/use-page-templates-in-your-confluence-space
// Image:   #7, section "Disable templates to prevent your users from using them" (Space settings > Templates: the
//          first blueprint's toggle off, hovered, with its "Enable / disable blueprint" tooltip; outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/v4u63p4y52lvk3pw410idso027m4d388.png
// Recipe:  public.screenshot_recipes where asset_id = 'v4u63p4y52lvk3pw410idso027m4d388'
// Opens the Templates page of the SyncUp space settings and hovers the first blueprint's toggle. The toggle is
// NOT clicked: an "off" toggle is drawn over it display-only (no event, nothing saved). The "Release readiness
// digest" space template is a display-only fake (test data, see AUC-1424 #6).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { blueprintRow, blueprintTable, dimAreas, fakeToggleOff, fakeUserTemplateRow, openTemplates } from "../lib/b3-conf";

const firstName = async (page: Page) => (await blueprintTable(page).locator("tr b").first().innerText()).trim();
const tooltip = (page: Page) => page.locator('[role="tooltip"]').filter({ hasText: /\S/ }).first();

runRecipe({
  file: "AUC-1424-7",
  assetId: "v4u63p4y52lvk3pw410idso027m4d388",
  title: "AUC-1424 #7 - Blueprint toggle off with tooltip",
  product: "confluence",

  async navigate(page, s) {
    await openTemplates(page, s);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeUserTemplateRow(page, FAKE_PEOPLE[0]);
    await anonymize(page, "AW", FAKE_PEOPLE);
    const row = blueprintRow(page, await firstName(page));
    const toggle = row.locator('input[type="checkbox"]').first();
    // Display-only: the toggle is drawn switched off; no click, no change event, nothing saved
    await fakeToggleOff(page, toggle);
    const label = row.locator("label").first();
    await label.hover();
    await tooltip(page).waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const area = [label, row.getByRole("button", { name: /^Promote/ })];
    if (await tooltip(page).isVisible().catch(() => false)) area.push(tooltip(page));
    await dimAreas(page, [area]);
  },

  mask: (page) => [blueprintTable(page).locator("tbody tr").nth(2), blueprintTable(page).locator("tbody tr").nth(3)],

  async checks(page, c) {
    await c.check("First blueprint has an enable / disable toggle", async () => {
      const n = await blueprintTable(page).locator("tr").filter({ has: page.locator("b") }).first().locator('input[type="checkbox"]').count();
      return { pass: n === 1, detail: n ? `Toggle on "${await firstName(page)}"` : "No toggle" };
    });

    await c.check("Hovering the toggle shows 'Enable / disable blueprint'", async () => {
      const t = (await tooltip(page).innerText().catch(() => "")).trim();
      return { pass: /Enable \/ disable blueprint/i.test(t), detail: t ? `Tooltip: ${t}` : "No tooltip on hover" };
    });

    await c.check("Promote button next to the toggle", async () => {
      const v = await blueprintTable(page).getByRole("button", { name: /^Promote/ }).first().isVisible();
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
