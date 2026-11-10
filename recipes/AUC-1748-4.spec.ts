// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #4, section "Summary cards show features and admins."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ql5dn5e640qir0rp800d05jpkt54n6r0.png
// Recipe:  public.screenshot_recipes where asset_id = 'ql5dn5e640qir0rp800d05jpkt54n6r0'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

const suggestions = '[data-testid="admin-center-suggestion-section"]';

/** Replaces the names of the people on Mission control (Confluence admins card) with User A, User B... */
async function neutralPeople(page: Page) {
  await page.evaluate(() => {
    // Safety net: a profile picture that re-renders after anonymize() stays hidden
    const style = document.createElement("style");
    style.setAttribute("data-screenshot-tweak", "people");
    style.textContent = 'img[src*="/aa-avatar/"] { visibility: hidden !important; }';
    document.head.appendChild(style);
    const prefix = "More information about ";
    const real = Array.from(document.querySelectorAll(`[aria-label^="${prefix}"]`))
      .map((el) => el.getAttribute("aria-label")!.slice(prefix.length).trim())
      .filter((n) => n && n !== "this user");
    const names = new Map(Array.from(new Set(real)).map((n, i) => [n, `User ${String.fromCharCode(65 + i)}`]));
    const swap = (v: string) => { for (const [n, f] of names) v = v.replaceAll(n, f); return v; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
  });
}// A summary card is a bordered card-container with an h3 title
const card = (page: Page, title: string) =>
  page.locator('[data-testid="card-container"]').filter({ has: page.locator("h3", { hasText: title }) }).first();
const LESSON_CARDS = ["External access features", "New features", "Confluence admins"];

/** The lesson shows the page with the sidebar collapsed: hide it display-only (the real collapse is a saved preference). */
async function hideSidebar(page: Page) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#side-navigation")!.style.display = "none";
    // The layout grid keeps a fixed sidebar column; give its width to the main column
    document.querySelector<HTMLElement>("#unsafe-design-system-page-layout-root")!.style.gridTemplateColumns = `0px 0px ${innerWidth}px 0px`;
  });
  await page.waitForTimeout(1_500); // let the page reflow to its wide layout
}

runRecipe({
  file: "AUC-1748-4",
  assetId: "ql5dn5e640qir0rp800d05jpkt54n6r0",
  title: "AUC-1748 #4 - Mission control summary cards",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    // Names first: anonymize() then turns the avatars into initials
    await neutralPeople(page);
    await anonymize(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await hideSidebar(page);
    // Suggestions at the top, summary cards below it, as in the lesson
    await page.locator(mainContent).evaluate((m, sel) => {
      m.scrollBy(0, document.querySelector(sel)!.getBoundingClientRect().top - 85);
    }, suggestions);
    await page.waitForTimeout(1_000);
    // One outlined area around the summary cards that are shown
    const shown = [];
    for (const t of LESSON_CARDS) if (await card(page, t).isVisible()) shown.push(card(page, t));
    await spotlightAreas(page, [shown]);
  },

  // Suggestions depend on the site; feature states and the admin list are site data
  mask: (page) => [
    page.locator(suggestions),
    card(page, "Confluence admins").locator('[data-testid="header-container"] ~ *'),
  ],

  async checks(page, c) {
    await c.check(`Summary cards: ${LESSON_CARDS.join(", ")}`, async () => {
      const titles = (await page.locator('[data-testid="card-container"] h3').allInnerTexts())
        .map((t) => t.trim())
        .filter((t) => LESSON_CARDS.includes(t) || /features|admins/i.test(t));
      return sameOrder(titles, LESSON_CARDS);
    });

    await c.check("The summary cards shown sit side by side in one row", async () => {
      const boxes: { x: number; y: number; width: number; height: number }[] = [];
      for (const t of LESSON_CARDS) {
        const b = (await card(page, t).isVisible()) ? await card(page, t).boundingBox() : null;
        if (b) boxes.push(b);
      }
      const oneRow = boxes.length > 1 && boxes.every((b) => Math.abs(b.y - boxes[0].y) < 5);
      return { pass: oneRow, detail: `${boxes.length} cards, ${oneRow ? "in one row" : "stacked"}` };
    });

    await c.check("External access features: Guests, Public links, Anonymous access, JSM access", async () => {
      const ids = await card(page, "External access features").locator('[data-testid^="EnabledStateBaseCard-SingleFeature-"]').evaluateAll((els) =>
        els.map((e) => e.getAttribute("data-testid")!.replace("EnabledStateBaseCard-SingleFeature-", "")),
      );
      return sameOrder(ids, ["Guests", "Public links", "Anonymous access", "JSM access"]);
    });

    await c.check("External access features card links to 'Manage global permissions'", async () => {
      const link = await card(page, "External access features").getByRole("link", { name: "Manage global permissions" }).isVisible();
      return { pass: link, detail: link ? "Present" : "Not found" };
    });

    await c.check("New features card links to 'Manage new features'", async () => {
      const visible = await card(page, "New features").isVisible();
      const link = visible && (await card(page, "New features").getByRole("link", { name: "Manage new features" }).isVisible());
      return { pass: link, detail: !visible ? "No New features card" : link ? "Present" : "Link not found" };
    });

    await c.check("Test data: Confluence admins card lists admins with a profile picture", async () => {
      const people = await card(page, "Confluence admins").locator('[data-testid="user-profile-card-trigger-wrapper"]').count();
      return { pass: people > 0, detail: `${people} admins listed` };
    });
  },
});
