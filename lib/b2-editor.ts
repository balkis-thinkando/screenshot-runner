import { Page } from "@playwright/test";
import { openSignedIn } from "./jira";
import { ROVO_PAGE } from "./confluence";
import { Settings } from "./supabase";

// Shared steps for the Confluence editor recipes (AUC-404). The editor is only opened, hovered and clicked into:
// nothing is typed into the page, no emoji or image is picked and nothing is published. Leaving the editor
// (the test closes the browser) keeps the page unchanged; checked 17 Nov 2026 (published and draft versions
// were the same before and after).

/** The page whose editor is opened: the SyncUp "Engineering onboarding guide" (text, an info panel, a table). */
export const EDIT_PAGE = ROVO_PAGE;

/** Closest test data for AUC-404 #1: a how-to page with a title emoji (rocket). The site has no page with both a
 *  header image and a title emoji (17 Nov 2026), so the header image check fails until one is added. */
export const EMOJI_PAGE = { space: "MKB", id: "1998867", title: "How-to: Configure email on a new mobile device" };

export const editor = '.ProseMirror[contenteditable="true"]';
export const mainToolbar = (page: Page) => page.locator('[role="toolbar"]').first();
export const titleBox = (page: Page) => page.locator('[data-testid="editor-title-container"]');
/** The row above the title (Emoji, Status, Header image, Suggest title, density, width); shows on hover. */
export const titleRow = (page: Page) => page.locator('[data-testid="toolbar-above-title-wrapper"]');
export const widthButton = (page: Page) => page.getByRole("button", { name: "Adjust width" });

/** Opens the editor of EDIT_PAGE and waits for it to settle. */
export async function openEditor(page: Page, s: Settings) {
  await openSignedIn(page, s, `/wiki/spaces/${EDIT_PAGE.space}/pages/edit-v2/${EDIT_PAGE.id}`);
  await page.locator(editor).first().waitFor({ timeout: 60_000 });
  await mainToolbar(page).waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
  // Close pop-ups (feature tours); hiding them can leave the page dimmed
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible().catch(() => false)) await page.keyboard.press("Escape");
}

/** Puts the cursor at the start of the first paragraph (a click, nothing typed), as a learner about to format text. */
export async function clickIntoBody(page: Page) {
  const p = page.locator(`${editor} p`).filter({ hasText: /\S.{40,}/ }).first();
  const box = (await p.boundingBox())!;
  await page.mouse.click(box.x + 2, box.y + box.height / 2);
  await page.waitForTimeout(800);
}

/** Hovers the title so the row above it (Emoji, Status, ..., Adjust width) shows. */
export async function hoverTitle(page: Page) {
  const box = (await titleBox(page).boundingBox())!;
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2);
  await page.waitForTimeout(1_000);
}

/** Replaces the author in the byline ("By <name>") with a fake person; returns false when there is no byline. */
export async function fakeByline(page: Page, fake: string) {
  return page.evaluate((fake) => {
    const trigger = document.querySelector('[data-testid="owner-with-contributors-dropdown-trigger"]');
    if (!trigger) return false;
    const walker = document.createTreeWalker(trigger, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue?.trim()) n.nodeValue = /^\s*By\b/.test(n.nodeValue) ? `By ${fake}` : "";
    }
    trigger.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) if (el.getAttribute(a)) el.setAttribute(a, fake);
    });
    return true;
  }, fake);
}

/** Hides tooltips left over from a click or focus. */
export async function hideTooltips(page: Page) {
  // A style element added from page script (addStyleTag can be refused by the site's content security policy)
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.setAttribute("data-screenshot-tweak", "tooltips");
    style.textContent = '[role="tooltip"] { visibility: hidden !important; }';
    document.head.appendChild(style);
  });
}

/** Hides the "Back to top" pill that floats over the space sidebar after a scroll. */
export async function hideBackToTop(page: Page) {
  await page.evaluate(() => {
    for (const b of Array.from(document.querySelectorAll<HTMLElement>("button"))) {
      if (b.innerText.trim() === "Back to top") b.style.visibility = "hidden";
    }
  });
}

/** Tooltip-free names of the visible buttons of the main editor toolbar, from their icon labels. */
export async function toolbarLabels(page: Page) {
  return mainToolbar(page).locator("button:visible").evaluateAll((bs) =>
    bs.map((b) => {
      const own = b.getAttribute("aria-label") ?? "";
      const icon = Array.from(b.querySelectorAll("[aria-label]")).map((e) => e.getAttribute("aria-label")).join(" ");
      return (own || icon || (b as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
    }),
  );
}

type Box = { x: number; y: number; width: number; height: number };

/** Lesson-style orange outlines without dimming the page (AUC-404 #2 and #5 outline but don't dim). */
export async function outlineBoxes(page: Page, boxes: Box[]) {
  await page.evaluate((boxes) => {
    const pad = 4;
    for (const b of boxes) {
      const d = document.createElement("div");
      d.setAttribute("data-screenshot-tweak", "outline");
      d.style.cssText =
        `position:fixed;pointer-events:none;z-index:2147483647;left:${b.x - pad}px;top:${b.y - pad}px;` +
        `width:${b.width + pad * 2}px;height:${b.height + pad * 2}px;border:3px solid #FCA700;border-radius:12px;box-sizing:border-box`;
      document.body.appendChild(d);
    }
  }, boxes);
}

/** Union of several boxes. */
export function union(boxes: (Box | null)[]): Box {
  const bs = boxes.filter(Boolean) as Box[];
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
}
