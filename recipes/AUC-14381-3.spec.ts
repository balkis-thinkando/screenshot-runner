// Lesson:  AUC-14381 - Create, share, and refine diagrams with Rovo
//          https://community.atlassian.com/learning/lesson/create-share-and-refine-diagrams-with-rovo
// Image:   #3, sticky notes selected on a Rovo-made whiteboard: toolbar with Ask Rovo, Group related and
//          "Create 3 Jira work items" (toolbar outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT21BZL.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT21BZL'
// Test data: the brainstorming whiteboard in SyncUp (lib/confluence.ts ROVO_WHITEBOARD). Three sticky notes are
// selected by clicking (never dragged, so nothing moves); no toolbar action is clicked.
// The board is a canvas: the notes are found at their position after the board's fit-to-screen view.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openWhiteboard, ROVO_WHITEBOARD } from "../lib/confluence";
import { keepAgentIcons } from "../lib/rovo";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

// The first three sticky notes of the board's left column (yellow, blue, purple) in the 1280x800 fit view
const NOTES = [{ x: 368, y: 367 }, { x: 427, y: 367 }, { x: 368, y: 409 }];
// The board (canvas and its floating toolbars) is in an iframe
const board = (page: Page) => page.frameLocator('iframe[src*="/whiteboards/whiteboard/"]');
// The floating toolbar of the selection
const toolbar = (page: Page) =>
  board(page).locator("div").filter({ has: board(page).getByText("Ask Rovo", { exact: true }) }).filter({ has: board(page).getByText(/^(Generate diagram|Group related)$/) }).last();
const createItems = (page: Page) => toolbar(page).locator('button[aria-label*="work item" i], [role=button][aria-label*="work item" i]').first();

runRecipe({
  file: "AUC-14381-3",
  assetId: "AT21BZL",
  title: "AUC-14381 #3 - Sticky notes, Rovo toolbar",
  product: "confluence",

  async navigate(page, s) {
    await openWhiteboard(page, s);
    await page.mouse.click(NOTES[0].x, NOTES[0].y);
    await page.waitForTimeout(500);
    await page.keyboard.down("Shift");
    for (const n of NOTES.slice(1)) {
      await page.mouse.click(n.x, n.y);
      await page.waitForTimeout(500);
    }
    await page.keyboard.up("Shift");
    await toolbar(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    // The lesson shows the tooltip of the "Create work items" button
    if (await createItems(page).isVisible()) await createItems(page).hover();
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await keepAgentIcons(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    // The toolbar is inside the board's iframe: outline a box placed over it in the page itself
    // From "Ask Rovo", climb to the widest block that is still toolbar-sized; boundingBox() gives page coordinates
    const handle = await board(page).getByText("Ask Rovo", { exact: true }).last().evaluateHandle((el) => {
      let best: Element = el;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const r = a.getBoundingClientRect();
        if (r.width > 900 || r.height > 80) break;
        if (r.width > 0 && r.height > 0) best = a; // skip layout-only wrappers (display: contents)
      }
      return best;
    });
    const raw = await handle.asElement()?.boundingBox();
    // The board's iframe reports positions shifted right by its own left offset (the sidebar width): take it off
    const frame = await page.locator('iframe[src*="/whiteboards/whiteboard/"]').boundingBox();
    const box = raw && frame ? { ...raw, x: raw.x - frame.x } : raw;
    if (box) {
      await page.evaluate((b) => {
        const d = document.createElement("div");
        d.id = "screenshot-toolbar-box";
        Object.assign(d.style, { position: "fixed", left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px`, pointerEvents: "none" });
        document.body.appendChild(d);
      }, box);
      await spotlight(page, page.locator("#screenshot-toolbar-box"), { markers: false });
    }
  },

  // "Edited 2h ago" (or "Saved") in the header changes on every run
  mask: (page) => [page.getByText(/^(Edited .+ ago|Saved)$/)],

  async checks(page, c) {
    await c.check("Whiteboard title in the header", async () => {
      const title = await page.getByText(ROVO_WHITEBOARD.title).evaluateAll((es) => es.some((e) => e.getBoundingClientRect().width > 0));
      return { pass: title, detail: title ? "Present" : "Missing" };
    });

    await c.check("Selection toolbar: Ask Rovo and Group related", async () => {
      const ask = await toolbar(page).getByText("Ask Rovo", { exact: true }).isVisible();
      const group = await toolbar(page).getByText("Group related", { exact: true }).isVisible().catch(() => false);
      const gen = await toolbar(page).getByText("Generate diagram", { exact: true }).isVisible().catch(() => false);
      return { pass: ask && group, detail: `Ask Rovo: ${ask}; Group related: ${group}; Generate diagram: ${gen}` };
    });

    await c.check("Toolbar offers 'Create 3 Jira work items' for the 3 selected notes", async () => {
      const btn = createItems(page);
      const label = await btn.getAttribute("aria-label", { timeout: 3_000 }).catch(() => null);
      const disabled = label ? await btn.isDisabled().catch(() => false) : false;
      return { pass: /Create 3 Jira work items/.test(label ?? "") && !disabled, detail: label ? `"${label}"${disabled ? " (disabled)" : ""}` : "No Create work items button" };
    });
  },
});
