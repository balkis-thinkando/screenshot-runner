// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #3, section "Format your page" (editor, the text formatting group of the toolbar outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2bxp787rpq6o20swr6lviruf4u2g70vo.png
// Recipe:  public.screenshot_recipes where asset_id = '2bxp787rpq6o20swr6lviruf4u2g70vo'
// Opens the editor of the SyncUp "Engineering onboarding guide" and clicks into the first paragraph (nothing is
// typed or published). Sidebar hidden display-only as in the lesson. Outlines Bold through the text color button.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar } from "../lib/confluence";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { clickIntoBody, fakeByline, hideTooltips, mainToolbar, openEditor, toolbarLabels } from "../lib/b2-editor";

/** The formatting group: every visible toolbar button from Bold to the text color button. */
async function formattingGroup(page: Page) {
  const ids = await mainToolbar(page).locator("button:visible").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-testid")));
  const from = ids.indexOf("editor-toolbar__Bold");
  const to = ids.indexOf("text-color-highlight-menu");
  if (from < 0 || to < from) throw new Error("Bold or the text color button is missing from the toolbar");
  return Array.from({ length: to - from + 1 }, (_, i) => mainToolbar(page).locator("button:visible").nth(from + i));
}

runRecipe({
  file: "AUC-404-3",
  assetId: "2bxp787rpq6o20swr6lviruf4u2g70vo",
  title: "AUC-404 #3 - Text formatting toolbar group",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
    await clickIntoBody(page);
  },

  async tweak(page, s) {
    await hideSidebar(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[5]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "KC", FAKE_PEOPLE);
    await hideTooltips(page);
    await page.mouse.move(1279, 799);
    const group = await formattingGroup(page);
    await spotlight(page, group[0].or(group[group.length - 1]), { markers: false });
  },

  async checks(page, c) {
    await c.check("Text styles menu (Normal text) before the group", async () => {
      const t = await mainToolbar(page).getByRole("button", { name: /Text styles/ }).first().innerText().catch(() => "");
      return { pass: /Normal text|Heading/.test(t), detail: t ? `Shows: ${t.trim()}` : "Missing" };
    });

    await c.check("Bold, Italic and More formatting (...) buttons", async () => {
      const labels = await toolbarLabels(page);
      const has = { bold: labels.some((l) => /^Bold/.test(l)), italic: labels.some((l) => /^Italic/.test(l)), more: labels.some((l) => /More formatting/.test(l)) };
      return {
        pass: has.bold && has.italic && has.more,
        detail: `Bold: ${has.bold}; Italic: ${has.italic}; More formatting: ${has.more}${has.italic ? "" : " (Italic is now inside the More formatting menu)"}`,
      };
    });

    await c.check("Text alignment, text color and highlight color buttons", async () => {
      const align = await page.getByTestId("text-alignment-menu").isVisible();
      const color = await page.getByTestId("text-color-highlight-menu").isVisible();
      const separateHighlight = (await toolbarLabels(page)).some((l) => /^Highlight/i.test(l));
      return {
        pass: align && color && separateHighlight,
        detail: `Alignment: ${align}; text color: ${color}; separate highlight button: ${separateHighlight}${separateHighlight ? "" : " (text and highlight color are now one menu)"}`,
      };
    });

    await c.check("Bulleted list, Numbered list, Outdent and Indent buttons", async () => {
      const labels = await toolbarLabels(page);
      const separate = ["Numbered list", "Outdent", "Indent"].filter((w) => labels.some((l) => l.startsWith(w)));
      const listsMenu = await page.getByTestId("editor-toolbar__lists-and-indentation-menu").first().isVisible();
      return {
        pass: separate.length === 3,
        detail: separate.length === 3 ? "All present" : `Separate buttons: ${separate.join(", ") || "none"}${listsMenu ? "; the rest (Outdent, Indent) are now in a 'Lists' menu" : ""}`,
      };
    });
  },
});
