import { Frame, Page } from "@playwright/test";

// Whiteboard clean-up and zoom for the AUC-407 whiteboard shot (owner feedback SHOT-98, Nov 2026).

/** Texts of whiteboard banners and pop-ups seen in captures (the performance banner shows on some browsers,
 *  e.g. the CI runner, and not on others). */
const MESSAGE_TEXTS = [/browser settings are slowing down your whiteboard/i, /hardware acceleration/i, /Learn how to fix this/i];

/** Selectors of pop-ups: dialogs, onboarding spotlights, flags and banners. */
const POPUP_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-testid*="spotlight" i]',
  '[data-testid*="onboarding" i]',
  '[data-testid*="banner" i]',
  '[data-testid*="flag" i][role="alert"]',
  '[role="alert"]',
].join(",");

const CLOSE_NAME = /^(close|dismiss|close banner|close dialog|close modal|got it|not now|maybe later|no thanks|skip|ok|×)$/i;

const boardFrames = (page: Page) => page.frames().filter((f) => f.url().includes("/whiteboards/whiteboard/"));

/** Marks every visible pop-up or banner in a frame with data-fb-popup="<n>" and returns their short labels. */
async function markPopups(frame: Frame, start: number): Promise<string[]> {
  return frame
    .evaluate(
      ([selector, texts, n0]) => {
        document.querySelectorAll("[data-fb-popup]").forEach((e) => e.removeAttribute("data-fb-popup"));
        const res = (texts as string[]).map((t) => new RegExp(t, "i"));
        const visible = (e: Element) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 40 && r.height > 16 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
        };
        const found = new Set<HTMLElement>();
        for (const e of Array.from(document.querySelectorAll<HTMLElement>(selector as string))) {
          if (e.closest("[data-screenshot-tweak], [data-screenshot-area]") || !visible(e)) continue;
          // Not the whole page, and not an empty live region
          const r = e.getBoundingClientRect();
          if (r.width >= innerWidth - 4 && r.height >= innerHeight - 4 && !(e.innerText || "").trim()) continue;
          if (!(e.innerText || "").trim() && !e.querySelector("button")) continue;
          found.add(e);
        }
        // Banners found by their text: the largest banner-sized ancestor of the text
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
          if (el.children.length > 3) continue;
          const t = (el.innerText || "").trim();
          if (!t || t.length > 300 || !res.some((re) => re.test(t)) || !visible(el)) continue;
          let box: HTMLElement = el;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const r = a.getBoundingClientRect();
            if (r.height > 120 || (a.innerText || "").length > 400) break;
            box = a;
          }
          found.add(box);
        }
        // Keep the outermost of nested matches
        const list = Array.from(found).filter((e) => !Array.from(found).some((o) => o !== e && o.contains(e)));
        return list.map((e, i) => {
          e.setAttribute("data-fb-popup", String((n0 as number) + i));
          const t = (e.innerText || "").split("\n").filter((l) => l.trim() && !l.includes("@")).slice(0, 2).join(" / ");
          return `${e.getAttribute("role") ?? e.tagName.toLowerCase()}: ${t.slice(0, 90)}`;
        });
      },
      [POPUP_SELECTOR, MESSAGE_TEXTS.map((r) => r.source), start] as const,
    )
    .catch(() => []);
}

/**
 * Closes every dialog, banner or pop-up on the page and in the board's iframe: with its own close button
 * (Close, Dismiss, Got it...), else with Escape when allowed (Escape also clears a selection on the board, so
 * it is only used before an object is selected), else hidden display-only. Returns what it did, for the log.
 */
export async function closeBoardPopups(page: Page, opts: { escape: boolean }) {
  const done: string[] = [];
  for (const frame of [page.mainFrame(), ...boardFrames(page)]) {
    const where = frame === page.mainFrame() ? "page" : "board";
    const labels = await markPopups(frame, 0);
    for (const [i, label] of labels.entries()) {
      const box = frame.locator(`[data-fb-popup="${i}"]`);
      const close = box.getByRole("button", { name: CLOSE_NAME }).or(box.locator('button[aria-label*="close" i], button[aria-label*="dismiss" i]')).first();
      let how = "";
      if (await close.isVisible().catch(() => false)) {
        await close.click({ timeout: 5_000 }).catch(() => {});
        await box.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {});
        if (!(await box.isVisible().catch(() => false))) how = "closed";
      }
      if (!how && opts.escape) {
        await page.keyboard.press("Escape");
        await box.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
        if (!(await box.isVisible().catch(() => false))) how = "closed with Escape";
      }
      if (!how && (await box.isVisible().catch(() => false))) {
        // Display-only: hide the pop-up and the portal it sits in (with any dimmed backdrop)
        await box.evaluate((e) => {
          const portal = e.closest<HTMLElement>(".atlaskit-portal") ?? e;
          portal.style.setProperty("display", "none", "important");
        });
        how = "hidden";
      }
      if (how) done.push(`${where} ${label} (${how})`);
    }
  }
  return done;
}

/** Current zoom of the board, from the zoom button label (e.g. "Edit zoom - 12%"). */
export async function boardZoom(page: Page) {
  const label = await page.frameLocator('iframe[src*="/whiteboards/whiteboard/"]').getByRole("button", { name: /^Edit zoom/ }).getAttribute("aria-label");
  return Number(/(\d+)%/.exec(label ?? "")?.[1] ?? NaN);
}

/**
 * Zooms the board view with Ctrl + mouse wheel, one step per entry, around the given page point (the point under
 * the mouse stays in place). A view change only: nothing on the board moves and nothing is saved.
 */
export async function zoomBoardAt(page: Page, steps: { x: number; y: number; delta: number }[]) {
  for (const s of steps) {
    await page.mouse.move(s.x, s.y);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, s.delta);
    await page.keyboard.up("Control");
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1_500); // the canvas redraws at the new zoom
}

/** Dialogs, banners and pop-ups still visible on the page or the board (short labels, no email addresses). */
export async function visibleBoardPopups(page: Page) {
  const out: string[] = [];
  for (const frame of [page.mainFrame(), ...boardFrames(page)]) {
    out.push(...(await markPopups(frame, 0)));
  }
  return out;
}
