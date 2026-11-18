// Lesson:  AUC-407 - Create whiteboards in Confluence
//          https://community.atlassian.com/learning/lesson/create-whiteboards-in-confluence
// Image:   #3, section "Use whiteboard tools": the "Sticky Note Board" with one sticky note selected; outlined:
//          the selection toolbar (Ask Rovo, colour, text, format...), the right toolbar, the zoom controls and
//          the bottom toolbar, each with a caption
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12NY.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12NY'
// Needs test data: there is no "Sticky Note Board" on the site (Nov 2026). The recipe uses the closest board with
// sticky notes, the SyncUp brainstorming mind map (lib/b2-search.ts WHITEBOARDS.mindmap), and selects its first
// sticky note by clicking it (never dragged, so nothing moves; same note as AUC-14381-3). No toolbar action is
// clicked. The lesson's captions are not drawn.
// Owner feedback (SHOT-98): pop-ups and the "Your browser settings are slowing down your whiteboard" banner are
// closed (or hidden display-only), and the view is zoomed in from the fit view (12%) to about 46% on the sticky
// notes, as in the lesson (47%). Wheel and Ctrl + wheel change the view only; nothing moves and nothing is saved.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { boardFrame, boardTools, LABELLED_TOOLS, openBoard, outlineBoardAreas, toolPreviews, WHITEBOARDS } from "../lib/b2-search";
import { boardZoom, closeBoardPopups, visibleBoardPopups, zoomBoardAt } from "../lib/fb-whiteboard";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

const WB = WHITEBOARDS.mindmap;
// The yellow sticky note at the top of the board's left column, in the 1280x800 fit view (12%)
const NOTE = { x: 368, y: 367 };
// Lesson view (47%, the sticky notes filling the canvas): from the 12% fit view, scroll the view (mouse wheel,
// no Ctrl) so the selected note sits at NOTE_TARGET, then six Ctrl + wheel steps anchored there (12% to about
// 46%). The note stays under the mouse, so the note group lands in the middle of the canvas, the selection
// toolbar above it below the header; the mind map ends up off-screen
const NOTE_TARGET = { x: 660, y: 340 };
const ZOOM_STEPS = Array.from({ length: 6 }, () => ({ ...NOTE_TARGET, delta: -100 }));
// The floating toolbar of the selection, found from its Ask Rovo button
const selectionToolbar = (page: Page) => boardFrame(page).locator('[data-screenshot-area="selection-toolbar"]');

async function markSelectionToolbar(page: Page) {
  await boardFrame(page).getByText("Ask Rovo", { exact: true }).last().evaluate((el) => {
    let best: Element = el;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (r.width > 900 || r.height > 80) break;
      if (r.width > 0 && r.height > 0) best = a;
    }
    best.setAttribute("data-screenshot-area", "selection-toolbar");
  });
}

runRecipe({
  file: "AUC-407-3",
  assetId: "AT12NY",
  title: "AUC-407 #3 - Whiteboard tools, sticky note selected",
  product: "confluence",

  async navigate(page, s) {
    test.setTimeout(240_000); // the board can need loading again (below)
    await openBoard(page, s, WB);
    // Some loads come without Rovo (no Ask Rovo in the top bar, so none in the selection toolbar): load again
    const rovo = page.getByRole("button", { name: /Ask Rovo/ }).first();
    for (let i = 0; i < 2 && !(await rovo.waitFor({ timeout: 20_000 }).then(() => true, () => false)); i++) await openBoard(page, s, WB);
    // Pop-ups first, while Escape can still be used (it would clear the selection later)
    const closed = await closeBoardPopups(page, { escape: true });
    if (closed.length) console.log(`AUC-407-3 closed: ${closed.join("; ")}`);
    // The selection toolbar's Ask Rovo button can be late on the first selection: select again if it is missing
    const ask = boardFrame(page).getByText("Ask Rovo", { exact: true }).last();
    for (let attempt = 1; ; attempt++) {
      await page.mouse.click(NOTE.x, NOTE.y);
      if (await ask.waitFor({ timeout: 15_000 }).then(() => true, () => false)) break;
      if (attempt === 3) throw new Error(`The selection toolbar (Ask Rovo) did not show after selecting the sticky note (Rovo in the top bar: ${await rovo.isVisible()})`);
      await page.mouse.click(700, 180); // empty canvas: clears the selection
      await page.waitForTimeout(2_000);
    }
    if ((await boardZoom(page)) !== 12) console.log(`AUC-407-3: fit view is ${await boardZoom(page)}%, not 12%; zoom steps may need adjusting`);
    await page.mouse.move(800, 500);
    await page.mouse.wheel(NOTE.x - NOTE_TARGET.x, NOTE.y - NOTE_TARGET.y); // view scroll only
    await page.waitForTimeout(1_500);
    await zoomBoardAt(page, ZOOM_STEPS);
    await ask.waitFor({ timeout: 10_000 }); // still selected after the zoom
    await page.mouse.move(1279, 799);
    await page.waitForTimeout(1_000);
    // Anything that appeared meanwhile: close button or hidden (no Escape, the note stays selected)
    const late = await closeBoardPopups(page, { escape: false });
    if (late.length) console.log(`AUC-407-3 closed: ${late.join("; ")}`);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await markSelectionToolbar(page);
    await outlineBoardAreas(page, [selectionToolbar(page), boardTools.right(page), boardTools.zoom(page), boardTools.bottom(page)]);
  },

  // "Edited 1d ago" (or "Saved") in the header changes over time; so do the colours of the sticky note and shape tools
  mask: (page) => [page.getByText(/^(Edited .+ ago|Saved)$/), toolPreviews(page)],

  async checks(page, c) {
    await c.check("No dialog, banner or pop-up over the board", async () => {
      const left = await visibleBoardPopups(page);
      return { pass: !left.length, detail: left.length ? `Still visible: ${left.join("; ")}` : "None" };
    });

    await c.check("Board zoomed in from the fit view (lesson: 47%, Sticky Note Board)", async () => {
      const z = await boardZoom(page);
      return { pass: z >= 40 && z <= 55, detail: `${z}%` };
    });

    await c.check("Whiteboard title in the header", async () => {
      const title = await page.getByText(WB.title, { exact: true }).evaluateAll((es) => es.some((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().top < 120));
      return { pass: title, detail: title ? `Present (lesson board: "Sticky Note Board", not on the site)` : "Missing" };
    });

    await c.check("Selection toolbar below the header (not over the top bar)", async () => {
      const bar = await page.locator("#screenshot-board-box-0").boundingBox(); // the selection toolbar's outline box (page coordinates)
      return { pass: !!bar && bar.y > 120, detail: bar ? `Top at ${Math.round(bar.y)}px` : "Not found" };
    });

    await c.check("Selection toolbar: Ask Rovo, colour, text size, bold, list, lock, comment", async () => {
      const bar = selectionToolbar(page);
      const ask = await bar.getByText("Ask Rovo", { exact: true }).isVisible();
      const buttons = await bar.locator("button, [role=button]").evaluateAll((es) => es.filter((e) => e.getBoundingClientRect().width > 0).length);
      const gen = await bar.getByText("Generate diagram", { exact: true }).isVisible().catch(() => false);
      return { pass: ask && buttons >= 8, detail: `Ask Rovo: ${ask}; ${buttons} buttons${gen ? '; also "Generate diagram" (not in the lesson)' : ""}` };
    });

    await c.check("Right toolbar: comments, details, video, voting, private mode, timer, cursors", async () => {
      const names = ["comment", "details", "Record a video", "voting", "private-mode", "Timer", "Hide collaborator cursors"];
      const found = await Promise.all(names.map((n) => boardFrame(page).getByRole("button", { name: n, exact: true }).isVisible().catch(() => false)));
      const missing = names.filter((_, i) => !found[i]);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All 7 present" };
    });

    await c.check("Zoom controls (zoom in, percentage, zoom out)", async () => {
      const zin = await boardFrame(page).getByRole("button", { name: "Zoom in" }).isVisible();
      const pct = await boardFrame(page).getByRole("button", { name: /^Edit zoom - \d+%$/ }).isVisible();
      const zout = await boardFrame(page).getByRole("button", { name: "Zoom out" }).isVisible();
      return { pass: zin && pct && zout, detail: `In: ${zin}; percentage: ${pct}; out: ${zout}` };
    });

    await c.check("Bottom toolbar: section, stamp, Jira import, template, more", async () => {
      const found = await Promise.all(LABELLED_TOOLS.map((n) => boardFrame(page).getByRole("button", { name: n }).isVisible().catch(() => false)));
      const missing = LABELLED_TOOLS.filter((_, i) => !found[i]);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
