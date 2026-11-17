// Lesson:  AUC-407 - Create whiteboards in Confluence
//          https://community.atlassian.com/learning/lesson/create-whiteboards-in-confluence
// Image:   #2, section "What are whiteboards?": the "Target Audience Brainstorm" whiteboard (a mind map with
//          sticky notes and reactions) open in a Marketing space, selected in the content tree (no outline)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/s3t03rg0j8fx5pdx6iu713ova5761ff1.png
// Recipe:  public.screenshot_recipes where asset_id = 's3t03rg0j8fx5pdx6iu713ova5761ff1'
// Needs test data: the site has no "Target Audience Brainstorm" board and no Marketing space (Nov 2026 the only
// whiteboards are two SyncUp boards). The recipe uses the closest one, the SyncUp brainstorming mind map with
// sticky notes (lib/b2-search.ts WHITEBOARDS.mindmap, also the AUC-14381 board), at its fit-to-screen zoom.
// Nothing on the board is clicked.

import { runRecipe } from "../lib/recipe";
import { boardFrame, boardTools, LABELLED_TOOLS, openBoard, treeItem, toolPreviews, WHITEBOARDS } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

const WB = WHITEBOARDS.mindmap;

runRecipe({
  file: "AUC-407-2",
  assetId: "s3t03rg0j8fx5pdx6iu713ova5761ff1",
  title: "AUC-407 #2 - Whiteboard in a space",
  product: "confluence",

  async navigate(page, s) {
    await openBoard(page, s, WB);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
  },

  // "Edited 1d ago" (or "Saved") in the header changes over time; so do the colours of the sticky note and shape tools
  mask: (page) => [page.getByText(/^(Edited .+ ago|Saved)$/), toolPreviews(page)],

  async checks(page, c) {
    await c.check("Whiteboard title in the header, with Share and copy link", async () => {
      const title = await page.getByText(WB.title, { exact: true }).evaluateAll((es) => es.some((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().top < 120));
      const share = await page.getByRole("button", { name: /^Share/ }).first().isVisible();
      return { pass: title && share, detail: `Title: ${title}; Share: ${share} (lesson board: "Target Audience Brainstorm", not on the site)` };
    });

    await c.check("Whiteboard selected in the space's content tree", async () => {
      const item = treeItem(page, WB.title);
      const shown = await item.isVisible().catch(() => false);
      const current = shown ? await item.evaluate((el) => el.getAttribute("aria-current") ?? el.closest("[aria-current],[aria-selected=true]")?.getAttribute("aria-current") ?? (el.getAttribute("aria-selected") === "true" ? "selected" : null)).catch(() => null) : null;
      return { pass: shown && !!current, detail: `In tree: ${shown}; current: ${current ?? "no"}` };
    });

    await c.check("Board canvas with content (mind map, sticky notes)", async () => {
      const canvas = await boardFrame(page).locator("canvas").first().isVisible();
      return { pass: canvas, detail: canvas ? "Canvas drawn" : "No canvas" };
    });

    await c.check("Right toolbar (comments, details, video, voting, timer...)", async () => {
      const names = ["comment", "details", "Record a video", "voting", "Timer"];
      const found = await Promise.all(names.map((n) => boardFrame(page).getByRole("button", { name: n, exact: true }).isVisible().catch(() => false)));
      const missing = names.filter((_, i) => !found[i]);
      return { pass: !missing.length && (await boardTools.right(page).isVisible()), detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Zoom controls (zoom in, percentage, zoom out)", async () => {
      const zin = await boardFrame(page).getByRole("button", { name: "Zoom in" }).isVisible();
      const pct = await boardFrame(page).getByRole("button", { name: /^Edit zoom - \d+%$/ }).isVisible();
      const zout = await boardFrame(page).getByRole("button", { name: "Zoom out" }).isVisible();
      return { pass: zin && pct && zout, detail: `In: ${zin}; percentage: ${pct}; out: ${zout}` };
    });

    await c.check("Bottom toolbar with the creation tools", async () => {
      const found = await Promise.all(LABELLED_TOOLS.map((n) => boardFrame(page).getByRole("button", { name: n }).isVisible().catch(() => false)));
      const missing = LABELLED_TOOLS.filter((_, i) => !found[i]);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Section, Stamp, Jira import, Template, More present" };
    });
  },
});
