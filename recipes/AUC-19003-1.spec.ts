// Lesson:  AUC-19003 - Edit existing content with Rovo
//          https://community.atlassian.com/learning/lesson/edit-existing-content-with-rovo
// Image:   #1, section "How to use Rovo to edit content" (cropped: selected sentence, toolbar, Ask Rovo menu)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12OTYU.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12OTYU'
// Opens the page in the editor and selects a sentence; nothing is typed, changed or published (owner OK, 13 Nov 2026).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { ROVO_PAGE } from "../lib/confluence";
import { anonymize, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

const editor = '.ProseMirror[contenteditable="true"]';
const toolbar = '[data-testid="editor-floating-toolbar"]';
// The page's opening sentence (outside the table), as the lesson selects a plain paragraph
const sentence = (page: Page) =>
  page.locator(`${editor} p`).filter({ hasText: /^Orientation material/ }).or(page.locator(`${editor} p`).filter({ hasText: /\w{20,}/ })).first();
const menu = (page: Page) => page.getByRole("menu").filter({ hasText: /Fix spelling|Improve/ }).last();
let clip = { x: 0, y: 0, width: 1280, height: 800 };

runRecipe({
  file: "AUC-19003-1",
  assetId: "AT12OTYU",
  title: "AUC-19003 #1 - Ask Rovo menu in the editor",
  product: "confluence",

  async navigate(page, s) {
    await openSignedIn(page, s, `/wiki/spaces/${ROVO_PAGE.space}/pages/edit-v2/${ROVO_PAGE.id}`);
    await page.locator(editor).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3_000);
    // Select the first sentence: the floating toolbar appears
    // Select it with a mouse drag from its first to its last character, as a learner would
    await sentence(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_000);
    const ends = await sentence(page).evaluate((p) => {
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
    await anonymize(page, "AU", FAKE_PEOPLE);
    // Crop to the sentence, the toolbar and the menu, as in the lesson (about 1000 x 400)
    const boxes = [await sentence(page).boundingBox(), await page.locator(toolbar).first().boundingBox(), await menu(page).boundingBox()].filter(Boolean) as { x: number; y: number; width: number; height: number }[];
    const left = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 24);
    const right = Math.min(1280, Math.max(...boxes.map((b) => b.x + b.width)) + 24);
    const top = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 24);
    const bottom = Math.min(800, Math.max(...boxes.map((b) => b.y + b.height)) + 24);
    clip = { x: left, y: top, width: right - left, height: bottom - top };
  },

  get clip() {
    return clip;
  },

  async checks(page, c) {
    await c.check("Floating toolbar: Ask Rovo, Improve writing, Remix", async () => {
      const missing = [];
      for (const t of [/Ask Rovo/, /Improve writing/, /Remix/]) if (!(await page.locator(`${toolbar} button`, { hasText: t }).first().isVisible())) missing.push(t.source);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Toolbar formatting buttons and Comment", async () => {
      const comment = await page.locator(`${toolbar} button`, { hasText: /^Comment/ }).first().isVisible();
      const count = await page.locator(`${toolbar} button`).count();
      return { pass: comment && count >= 6, detail: `Comment: ${comment}; ${count} toolbar buttons` };
    });

    await c.check("Rovo menu: Improve formatting, Fix spelling and grammar, Change tone, Make shorter, Make longer, Translate options, Define", async () => {
      const items = (await menu(page).getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
      const want = ["Improve formatting", "Fix spelling and grammar", "Change tone", "Make shorter", "Make longer", "Translate options", "Define"];
      const missing = want.filter((w) => !items.some((i) => i.startsWith(w)));
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}` };
    });
  },
});
