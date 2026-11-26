// Lesson:  AUC-403 - Create pages in Confluence
//          https://community.atlassian.com/learning/lesson/how-to-create-a-page-in-confluence
// Image:   #7, section "Publish and update pages" (an existing page in edit mode: the Update button and its
//          arrow outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/52vs8u52i40ep62un47k70jbovd86472.png
// Recipe:  public.screenshot_recipes where asset_id = '52vs8u52i40ep62un47k70jbovd86472'
// Opens the editor of the SyncUp "Engineering onboarding guide" (lib/b2-editor.ts; the lesson uses a Marketing
// page). Nothing is typed, clicked or published; the test closes the browser, leaving the page unchanged.

import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { fakeByline, hideBackToTop, hideTooltips, mainToolbar, openEditor } from "../lib/b2-editor";
import { dimAreas, updateButton, updateChevron } from "../lib/b3-conf";

runRecipe({
  file: "AUC-403-7",
  assetId: "52vs8u52i40ep62un47k70jbovd86472",
  title: "AUC-403 #7 - Editor Update button",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideTooltips(page);
    await hideBackToTop(page);
    await dimAreas(page, [[updateButton(page), updateChevron(page)]]);
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Update button (an existing page is updated, not published)", async () => {
      const t = (await updateButton(page).innerText().catch(() => "")).trim();
      return { pass: t === "Update", detail: t ? `Button: ${t}` : "No Update or Publish button" };
    });

    await c.check("Arrow next to Update for more options", async () => {
      const b = await updateChevron(page).boundingBox().catch(() => null);
      const u = (await updateButton(page).boundingBox())!;
      const next = !!b && b.x - (u.x + u.width) < 8 && b.width < 40;
      return { pass: next, detail: next ? "Present" : "No arrow button right next to Update" };
    });

    await c.check("Close button next to Update", async () => {
      const v = await page.getByRole("button", { name: "Close", exact: true }).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Editor toolbar under the header", async () => {
      const n = await mainToolbar(page).locator("button:visible").count();
      return { pass: n > 8, detail: `${n} toolbar buttons` };
    });
  },
});
