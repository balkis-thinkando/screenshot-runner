// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #5, section "Use Rovo to enhance content" (editor, a paragraph selected, the floating toolbar and the
//          Ask Rovo menu outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14A9L.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14A9L'
// Same steps as AUC-19003 #1: opens the editor of the SyncUp "Engineering onboarding guide", drag-selects the
// first paragraph and opens the Ask Rovo menu. Nothing is typed, changed or published (owner OK). Full window
// with the space sidebar, as in the lesson.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { editor, fakeByline, hideBackToTop, hideTooltips, openEditor, outlineBoxes, union } from "../lib/b2-editor";

const toolbar = '[data-testid="editor-floating-toolbar"]';
const paragraph = (page: Page) =>
  page.locator(`${editor} p`).filter({ hasText: /^Orientation material/ }).or(page.locator(`${editor} p`).filter({ hasText: /\w{20,}/ })).first();
const menu = (page: Page) => page.getByRole("menu").filter({ hasText: /Fix spelling|Improve|polish/ }).last();

runRecipe({
  file: "AUC-404-5",
  assetId: "AT14A9L",
  title: "AUC-404 #5 - Ask Rovo menu on selected text",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
    await paragraph(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_000);
    // Drag from the first to the last character, as a learner would
    const ends = await paragraph(page).evaluate((p) => {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      const texts: Text[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.trim()) texts.push(n as Text);
      const rect = (t: Text, at: number) => {
        const r = document.createRange();
        r.setStart(t, at);
        r.setEnd(t, at + 1);
        return r.getBoundingClientRect();
      };
      const first = rect(texts[0], 0);
      const lastText = texts[texts.length - 1];
      const last = rect(lastText, lastText.length - 1);
      return { x1: first.left + 1, y1: first.top + first.height / 2, x2: last.right - 1, y2: last.top + last.height / 2 };
    });
    await page.mouse.move(ends.x1, ends.y1);
    await page.mouse.down();
    await page.mouse.move(ends.x2, ends.y2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1_000);
    const ask = page.locator(`${toolbar} [data-testid="editor-toolbar__ask-rovo"]:visible`).first();
    await ask.waitFor({ timeout: 20_000 });
    // The arrow right after Ask Rovo opens the editing options (it has no label of its own)
    const buttons = page.locator(`${toolbar} button:visible`);
    const askIndex = await buttons.evaluateAll((bs) => bs.findIndex((b) => b.getAttribute("data-testid") === "editor-toolbar__ask-rovo"));
    await buttons.nth(askIndex + 1).click();
    await menu(page).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[5]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "KC", FAKE_PEOPLE);
    await hideBackToTop(page);
    await hideTooltips(page);
    await outlineBoxes(page, [union([await page.locator(toolbar).first().boundingBox(), await menu(page).boundingBox()])]);
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Paragraph selected", async () => {
      const sel = await page.evaluate(() => (getSelection()?.toString() ?? "").trim().length);
      return { pass: sel > 40, detail: `${sel} characters selected` };
    });

    await c.check("Floating toolbar: Ask Rovo, Improve writing, Comment, More", async () => {
      const missing = [];
      for (const t of [/Ask Rovo/, /Improve writing/, /^Comment/]) if (!(await page.locator(`${toolbar} button`, { hasText: t }).first().isVisible())) missing.push(t.source);
      const extra = (await page.locator(`${toolbar} button`, { hasText: /Remix/ }).first().isVisible()) ? "; also shows Remix (not in the lesson)" : "";
      return { pass: !missing.length, detail: (missing.length ? `Missing: ${missing.join(", ")}` : "All present") + extra };
    });

    await c.check("Rovo menu: Add polish, Fix spelling and grammar, Change tone, Make shorter, Make longer, Translate options, Define", async () => {
      const items = (await menu(page).getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
      const want = ["Add polish", "Fix spelling and grammar", "Change tone", "Make shorter", "Make longer", "Translate options", "Define"];
      const missing = want.filter((w) => !items.some((i) => i.startsWith(w)));
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });
  },
});
