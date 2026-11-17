// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #6, section "Adjust page width" (editor, the page width arrow button at the right above the title outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2is23i5o5vf37076f665sk2q45046t2w.png
// Recipe:  public.screenshot_recipes where asset_id = '2is23i5o5vf37076f665sk2q45046t2w'
// Opens the editor of the SyncUp "Engineering onboarding guide" and hovers the title so the width button shows
// (nothing is typed, clicked or published). Sidebar hidden display-only as in the lesson.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar } from "../lib/confluence";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakeByline, hideTooltips, hoverTitle, openEditor, titleBox, titleRow, widthButton } from "../lib/b2-editor";

runRecipe({
  file: "AUC-404-6",
  assetId: "2is23i5o5vf37076f665sk2q45046t2w",
  title: "AUC-404 #6 - Adjust page width button",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
  },

  async tweak(page, s) {
    await hideSidebar(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[5]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "KC", FAKE_PEOPLE);
    await hideTooltips(page);
    // The button only shows while the title is hovered, so the mouse stays there
    await hoverTitle(page);
    await widthButton(page).waitFor({ timeout: 10_000 });
    await spotlight(page, widthButton(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Adjust width button (two-way arrow)", async () => {
      const v = await widthButton(page).isVisible();
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Width button on its own at the right edge of the page content", async () => {
      const b = (await widthButton(page).boundingBox())!;
      const t = (await page.locator('[data-testid="editor-title-with-buttons-div"]').boundingBox()) ?? (await titleBox(page).boundingBox())!;
      const right = b.x + b.width > t.x + t.width * 0.8;
      const row = (await titleRow(page).innerText()).replace(/\s+/g, " ").trim();
      return { pass: right, detail: right ? "At the right" : `Now in the row above the title, after: ${row}` };
    });

    await c.check("Width button is a single arrow, no dropdown", async () => {
      const w = (await widthButton(page).boundingBox())!.width;
      return { pass: w < 40, detail: w < 40 ? "Single arrow button as in the lesson" : `Button is ${Math.round(w)}px wide: arrow plus a dropdown chevron (opens width options)` };
    });
  },
});
