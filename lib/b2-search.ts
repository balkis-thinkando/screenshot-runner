import { Locator, Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";
import { FAKE_PEOPLE, spotlightAreas } from "./tweaks";

// Shared steps for the batch 2 Confluence search, Rovo answer and whiteboard recipes (AUC-412, AUC-12905, AUC-407).

/** Opens a Confluence URL through Atlassian sign-in (a page opened directly can stop at the sign-in screen). */
export async function openWiki(page: Page, s: Settings, path: string, ready: Locator, what: string) {
  const url = `${s.test_site}/wiki${path}`;
  await page.goto(`https://id.atlassian.com/login?continue=${encodeURIComponent(url)}`, { waitUntil: "commit" });
  await ready.waitFor({ timeout: 60_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (!(await ready.isVisible())) {
    const denied = await page.getByText(/don't have (permission|access)|not authorized/i).first().isVisible().catch(() => false);
    if (denied) throw new Blocked(`The test account cannot open ${what}`);
    throw new Error(`${what} did not load`);
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

// ---------- Search ----------

export const searchInput = (page: Page) => page.getByTestId("search-input");
export const searchDialog = (page: Page) => page.getByTestId("search-dialog");

/** The full search page (advanced search) for a query, ready once the app filter tabs show. */
export async function openSearchPage(page: Page, s: Settings, query: string) {
  await openWiki(page, s, `/search?text=${encodeURIComponent(query)}`, page.getByTestId("filter-all"), "the search page");
}

/** The Rovo answer card above the search results ("Overview" heading, collapsed with "Show more"). */
export const answerHeading = (page: Page) => page.locator("h1, h2, h3").filter({ hasText: /^(Overview|Answer)$/ }).first();
export const answerCard = (page: Page) =>
  page
    .locator("div")
    .filter({ has: answerHeading(page) })
    .filter({ has: page.getByRole("button", { name: /^(Show more|Show less|Read more)$/ }) })
    .last();

/** Waits for Rovo's answer to a natural-language search (it streams in after the results). */
export async function waitForAnswer(page: Page) {
  await answerHeading(page).waitFor({ timeout: 90_000 });
  await answerCard(page).waitFor({ timeout: 90_000 });
  // The text keeps streaming for a while: wait until its length stops changing
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const len = (await answerCard(page).innerText().catch(() => "")).length;
    if (len === last && len > 100) break;
    last = len;
    await page.waitForTimeout(2_000);
  }
}

/** Hides Rovo's "Can I help you find something, <name>?" nudge (display-only; nothing is dismissed). */
export async function hideRovoNudge(page: Page) {
  // It slides in a few seconds after the page loads
  await page.getByTestId("platform-ai-proactive-nudge-dismiss").waitFor({ timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('[data-testid="platform-ai-proactive-nudge-dismiss"]');
    for (let box = btn; box && box.getBoundingClientRect().height < 120 && box.getBoundingClientRect().width < 500; box = box.parentElement) box.style.visibility = "hidden";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (el.children.length === 0 && /^Can I help you find something/.test(el.textContent?.trim() ?? "")) {
        for (let box: HTMLElement | null = el; box && box.getBoundingClientRect().height < 120 && box.getBoundingClientRect().width < 500; box = box.parentElement) box.style.visibility = "hidden";
      }
    }
  });
}

/** The whole search box in the top bar (the input is only its text part): marked so it can be outlined. */
export async function searchBox(page: Page) {
  await searchInput(page).evaluate((el) => {
    let box: HTMLElement = el as HTMLElement;
    while (box.parentElement && box.getBoundingClientRect().width < 450) box = box.parentElement;
    box.setAttribute("data-screenshot-area", "search-box");
  });
  return page.locator('[data-screenshot-area="search-box"]');
}

/** Marks team pictures (also served as avatars) in the search drop-down so anonymize() leaves them alone. */
export async function keepTeamIcons(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="search-dialog"] img').forEach((img) => {
      // The result row around the picture: the first ancestor with text
      let row = img.parentElement;
      for (let i = 0; row && i < 6 && !(row.innerText ?? "").trim(); i++) row = row.parentElement;
      for (let i = 0; row && i < 3 && !/\n/.test((row.innerText ?? "").trim()); i++) row = row.parentElement;
      if (row && /(^|\n)\s*Team\s*$/.test(row.innerText.trim())) img.setAttribute("data-screenshot-keep", "");
    });
  });
}

/** Personal spaces are named after people: show fake names for them (sidebar, results, breadcrumbs). */
export async function fakePersonalSpaces(page: Page, people = FAKE_PEOPLE.slice(6)) {
  await page.evaluate(async (people) => {
    const r = await fetch("/wiki/api/v2/spaces?type=personal&limit=100").then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const names: string[] = Array.from(new Set<string>((r?.results ?? []).map((sp: { name: string }) => sp.name).filter(Boolean)));
    if (!names.length) return;
    const swap = (v: string) => names.reduce((acc, n, i) => acc.replaceAll(n, people[i % people.length]), v);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title]").forEach((el) => {
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
  }, people);
}

// ---------- Whiteboards ----------

/** The whiteboards on the test site (Nov 2026 there are only these two, both in SyncUp). The Mindmap board has a
 *  mind map and a column of coloured sticky notes; it is also the AUC-14381 test board (ROVO_WHITEBOARD). */
export const WHITEBOARDS = {
  mindmap: { space: "SyncUp", id: "9895962", title: "Product Development and UX Brainstorming Mindmap" },
  framework: { space: "SyncUp", id: "10289162", title: "Product Development and UX Brainstorming Framework" },
};

/** The board (canvas and its floating toolbars) is drawn in an iframe. */
export const boardFrame = (page: Page) => page.frameLocator('iframe[src*="/whiteboards/whiteboard/"]');

/** Opens a whiteboard. The canvas draws lazily, so wait until the board has had time to paint. */
export async function openBoard(page: Page, s: Settings, wb: { space: string; id: string; title: string }) {
  await openWiki(page, s, `/spaces/${wb.space}/whiteboard/${wb.id}`, page.getByText(wb.title, { exact: true }).first(), `whiteboard ${wb.id}`);
  await boardFrame(page).getByRole("button", { name: "Zoom in" }).waitFor({ timeout: 60_000 });
  // The space's content tree loads after the board
  await treeItem(page, wb.title).waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(10_000);
  await markBottomToolbar(page);
}

/** Toolbars of the board (inside the iframe). The bottom toolbar is marked by openBoard() (see markBottomToolbar). */
export const boardTools = {
  // Bottom toolbar: select/hand, sticky note, pen, text, line, shape | section, stamp, Jira import, template, table | more
  bottom: (page: Page) => boardFrame(page).locator('[data-screenshot-area="bottom-toolbar"]'),
  // Right toolbar: comments, details, video, voting, private mode, timer, cursors
  right: (page: Page) =>
    boardFrame(page).locator("div").filter({ has: boardFrame(page).getByRole("button", { name: "comment", exact: true }) }).filter({ has: boardFrame(page).getByRole("button", { name: "Timer" }) }).last(),
  zoom: (page: Page) => boardFrame(page).getByTestId("canvas-zoom-controls-wrapper"),
};

/** Marks the whole bottom toolbar: from the Stamp tool, the widest ancestor that is still toolbar-sized. */
export async function markBottomToolbar(page: Page) {
  await boardFrame(page).getByRole("button", { name: "Stamp tool" }).evaluate((el) => {
    let best: Element = el;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (r.height > 120 || r.width > 900) break;
      if (r.width > 0) best = a;
    }
    best.setAttribute("data-screenshot-area", "bottom-toolbar");
    // The sticky note and shape tools preview a colour that changes from one load to the next: mark them for the mask
    const r0 = best.getBoundingClientRect();
    const tools = Array.from(best.querySelectorAll("li")).filter((li) => li.getBoundingClientRect().width >= 30 && li.getBoundingClientRect().left > r0.left + 50 && !li.parentElement?.closest("li"));
    for (const i of [0, 4]) tools[i]?.setAttribute("data-screenshot-mask", "tool-preview");
  });
}

/** Tool items of the bottom toolbar: the select/hand pair on the left, then the other tools (one list item each). */
export async function bottomTools(page: Page) {
  return boardTools.bottom(page).evaluate((bar) => {
    const r0 = bar.getBoundingClientRect();
    const items = Array.from(bar.querySelectorAll("li")).filter((li) => li.getBoundingClientRect().width >= 30 && !li.parentElement?.closest("li"));
    return {
      pointer: items.filter((li) => li.getBoundingClientRect().left <= r0.left + 50).length,
      tools: items.filter((li) => li.getBoundingClientRect().left > r0.left + 50).length,
    };
  });
}

/** Colour previews of the sticky note and shape tools (masked). */
export const toolPreviews = (page: Page) => boardFrame(page).locator('[data-screenshot-mask="tool-preview"]');

/**
 * Elements in the board's iframe can't be outlined from the page itself: places a transparent box over each one
 * in the page and returns them. Playwright can report frame elements shifted right by the iframe's own left
 * offset (see AUC-14381-3), so the offset is taken off when the box would otherwise run past the frame.
 */
export async function overlayBoxes(page: Page, items: Locator[]): Promise<Locator[]> {
  const frame = await page.locator('iframe[src*="/whiteboards/whiteboard/"]').boundingBox();
  const out: Locator[] = [];
  for (const [i, item] of items.entries()) {
    const raw = await item.boundingBox();
    if (!raw || !frame) throw new Error("overlayBoxes: an item is not visible");
    const shifted = raw.x + raw.width > frame.x + frame.width + 2;
    const box = shifted ? { ...raw, x: raw.x - frame.x } : raw;
    await page.evaluate(([b, id]) => {
      const d = document.createElement("div");
      d.id = id;
      d.setAttribute("data-screenshot-tweak", "board-box");
      Object.assign(d.style, { position: "fixed", left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px`, pointerEvents: "none" });
      document.body.appendChild(d);
    }, [box, `screenshot-board-box-${i}`] as const);
    out.push(page.locator(`#screenshot-board-box-${i}`));
  }
  return out;
}

/** Outlines several areas of the board (lesson style: page dimmed, orange outlines). */
export async function outlineBoardAreas(page: Page, items: Locator[]) {
  await spotlightAreas(page, await overlayBoxes(page, items));
}

/** Adds a transparent box over the main area from below `above` to the bottom of the window, for the mask
 *  (search results change run to run). Returns its locator. */
export async function markResultsArea(page: Page, above: Locator, name = "results") {
  const a = await above.boundingBox();
  const main = await page.locator("#AkMainContent, main").first().boundingBox();
  if (!a || !main) throw new Error("markResultsArea: area not visible");
  await page.evaluate(([top, left, width, name]) => {
    const d = document.createElement("div");
    d.dataset.screenshotMask = name;
    Object.assign(d.style, { position: "fixed", left: `${left}px`, width: `${width}px`, top: `${top}px`, bottom: "0px", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(d);
  }, [a.y + a.height + 8, main.x, main.width, name] as const);
  return page.locator(`[data-screenshot-mask="${name}"]`);
}

/** The whiteboard's entry in the space's content tree (sidebar), shown as the current item. */
export const treeItem = (page: Page, title: string) => page.locator("#side-navigation").locator("a, [role=treeitem]").filter({ hasText: title }).first();

/** Tools of the bottom toolbar as labelled in the board (Nov 2026). The first group (select, hand, sticky note,
 *  pen, text, line, shape) has no labels in the page, so it is counted by its buttons. */
export const LABELLED_TOOLS = ["Section tool", "Stamp tool", "Jira import tool", "Template tool", "More menu toolbar item"];
