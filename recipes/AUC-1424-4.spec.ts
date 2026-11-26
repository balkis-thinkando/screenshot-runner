// Lesson:  AUC-1424 - Use page templates in your Confluence space
//          https://community.atlassian.com/learning/lesson/use-page-templates-in-your-confluence-space
// Image:   #4, section "Blueprints are templates with additional features" (Space settings > Templates, the
//          Blueprint templates list scrolled to "Meeting notes Blueprint": its row and its two templates outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/13qu2vt0k628xhb6761t857b34yp31c0
// Recipe:  public.screenshot_recipes where asset_id = '13qu2vt0k628xhb6761t857b34yp31c0'
// Opens the Templates page of the SyncUp space settings (the lesson uses a Marketing space) and scrolls to the
// Meeting notes Blueprint. Nothing is toggled, promoted or edited. Which blueprints are listed depends on the
// site's apps, so the rows around it are masked.

import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { blueprintGroupRows, blueprintRow, blueprintTable, dimAreas, navLink, openTemplates } from "../lib/b3-conf";

const BLUEPRINT = "Meeting notes Blueprint";

runRecipe({
  file: "AUC-1424-4",
  assetId: "13qu2vt0k628xhb6761t857b34yp31c0",
  title: "AUC-1424 #4 - Meeting notes blueprint in the templates list",
  product: "confluence",

  async navigate(page, s) {
    await openTemplates(page, s);
    const row = blueprintRow(page, BLUEPRINT);
    await row.waitFor({ timeout: 30_000 });
    // Put the blueprint about a quarter down the window, as in the lesson
    await row.evaluate((r) => r.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await dimAreas(page, [await blueprintGroupRows(page, BLUEPRINT)]);
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [blueprintTable(page).locator("tr").filter({ hasNotText: BLUEPRINT })],

  async checks(page, c) {
    await c.check("Meeting notes Blueprint listed with a toggle (on) and Promote", async () => {
      const row = blueprintRow(page, BLUEPRINT);
      const toggle = row.locator('input[type="checkbox"]');
      const on = (await toggle.count()) ? await toggle.isChecked() : null;
      const promote = await row.getByRole("button", { name: /^Promote/ }).isVisible();
      return { pass: on === true && promote, detail: `Toggle: ${on === null ? "missing" : on ? "on" : "off"}; Promote: ${promote}` };
    });

    await c.check("Two templates under it, each with an edit button", async () => {
      const rows = (await blueprintGroupRows(page, BLUEPRINT)).slice(1);
      let edits = 0;
      for (const r of rows) if (await r.getByRole("link", { name: /^Edit / }).count()) edits++;
      return { pass: rows.length === 2 && edits === 2, detail: `${rows.length} template rows, ${edits} with an edit button` };
    });

    await c.check("Look and feel > Templates selected in the sidebar", async () => {
      const cur = await navLink(page, "Templates").getAttribute("aria-current");
      return { pass: cur === "page", detail: `aria-current: ${cur}` };
    });
  },
});
