// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #4, section "Add media, action items, links, and more" (editor, the insert group of the toolbar
//          outlined, with a callout line under each button)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/x8f23s43wvtw5288gk1gf832onw0w1x8.png
// Recipe:  public.screenshot_recipes where asset_id = 'x8f23s43wvtw5288gk1gf832onw0w1x8'
// Opens the editor of the SyncUp "Engineering onboarding guide" and clicks into the first paragraph (nothing is
// typed or published). Sidebar hidden display-only as in the lesson. Outlines Action item through Insert elements.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar } from "../lib/confluence";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, markers, renameOrg, spotlight } from "../lib/tweaks";
import { clickIntoBody, fakeByline, hideTooltips, mainToolbar, openEditor, toolbarLabels } from "../lib/b2-editor";

/** Indexes of the visible toolbar buttons from Action item to Insert elements. */
async function insertRange(page: Page) {
  const ids = await mainToolbar(page).locator("button:visible").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-testid")));
  const from = ids.indexOf("editor-toolbar-task-list-button");
  const to = ids.indexOf("editor-toolbar-insert-button");
  if (from < 0 || to < from) throw new Error("Action item or Insert elements is missing from the toolbar");
  return { from, to };
}

runRecipe({
  file: "AUC-404-4",
  assetId: "x8f23s43wvtw5288gk1gf832onw0w1x8",
  title: "AUC-404 #4 - Insert toolbar group",
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
    const { from, to } = await insertRange(page);
    const all = mainToolbar(page).locator("button:visible");
    await spotlight(page, all.nth(from).or(all.nth(to)), { markers: false });
    // A callout line under each button, alternating lengths as in the lesson (skip the Table size chevron)
    let buttons = all.nth(from);
    for (let i = from + 1; i <= to; i++) {
      if ((await all.nth(i).getAttribute("data-testid")) !== "editor-toolbar-table-selector-button") buttons = buttons.or(all.nth(i));
    }
    await markers(page, buttons, "down", [110, 190]);
  },

  async checks(page, c) {
    const group = async () => {
      const { from, to } = await insertRange(page);
      return (await toolbarLabels(page)).slice(from, to + 1).map((l) => l.replace(/\s*(⌘|⇧|\[\]|\/|:|@).*$/, "").trim());
    };

    await c.check("Insert group: Action item, Link, Image, Mention, Emoji, Layouts, Table, Insert elements", async () => {
      const items = await group();
      const want = [/Action item/, /Link/, /image/i, /Mention/, /Emoji/, /Layouts/, /Table/, /Insert elements/];
      const missing = want.filter((w) => !items.some((i) => w.test(i))).map((w) => w.source);
      return { pass: !missing.length, detail: `Group: ${items.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("No other buttons in the insert group", async () => {
      const items = await group();
      const extra = items.filter((i) => !/Action item|Link|image|Mention|Emoji|Layouts|Table|Insert elements/i.test(i));
      return { pass: !extra.length, detail: extra.length ? `Added: ${extra.join(", ")}` : "None" };
    });

    await c.check("Link button", async () => {
      const link = await page.getByTestId("editor-toolbar__link-button").isVisible();
      const { to } = await insertRange(page);
      const ids = await mainToolbar(page).locator("button:visible").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-testid")));
      const after = ids.indexOf("editor-toolbar__link-button") > to;
      return { pass: link, detail: link ? (after ? "Present, now after the insert group (after Insert elements)" : "Present") : "Missing" };
    });
  },
});
