// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #5, section "View detailed activity across your site."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/30n1f0068g5r88xaxme8ukl3o11dic1g.png
// Recipe:  public.screenshot_recipes where asset_id = '30n1f0068g5r88xaxme8ukl3o11dic1g'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg } from "../lib/tweaks";

const featureUsage = (page: Page) => page.locator("section").filter({ has: page.locator("h2", { hasText: "Feature usage" }) }).last();
// A card is a bordered card-container with an h3 title
const card = (page: Page, title: string) =>
  featureUsage(page).locator('[data-testid="card-container"]').filter({ has: page.locator("h3", { hasText: title }) }).first();
const LESSON_CARDS = ["Searches", "Most searched terms", "Search click-through rate", "Review these terms"];

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
}/** The lesson shows the page with the sidebar collapsed: hide it display-only (the real collapse is a saved preference). */
async function hideSidebar(page: Page) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#side-navigation")!.style.display = "none";
    // The layout grid keeps a fixed sidebar column; give its width to the main column
    document.querySelector<HTMLElement>("#unsafe-design-system-page-layout-root")!.style.gridTemplateColumns = `0px 0px ${innerWidth}px 0px`;
  });
  await page.waitForTimeout(1_500); // let the page reflow to its wide layout
}

runRecipe({
  file: "AUC-1748-5",
  assetId: "30n1f0068g5r88xaxme8ukl3o11dic1g",
  title: "AUC-1748 #5 - Mission control activity, feature usage",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await neutralPeople(page);
    await anonymize(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await hideSidebar(page);
    // Feature usage heading just below the top bar, as in the lesson
    await featureUsage(page).locator("h2").first().evaluate((h, sel) => {
      document.querySelector(sel)!.scrollBy(0, h.getBoundingClientRect().top - 80);
    }, mainContent);
    await page.waitForTimeout(1_500); // charts draw when they scroll into view
  },

  // Numbers, charts and search terms are site data: compare only the card titles and layout
  mask: (page) => LESSON_CARDS.map((t) => card(page, t).locator('[data-testid="header-container"] ~ *')),

  async checks(page, c) {
    await c.check(`Feature usage cards: ${LESSON_CARDS.join(", ")}`, async () => {
      const titles = (await featureUsage(page).locator('[data-testid="card-container"] h3').allInnerTexts()).map((t) => t.trim());
      return sameOrder(titles, LESSON_CARDS);
    });

    await c.check("Two columns: Searches and Search click-through rate on the left, the term lists on the right", async () => {
      const b = [];
      for (const t of LESSON_CARDS) b.push(await card(page, t).boundingBox());
      const [searches, terms, ctr, review] = b;
      const pass = !!searches && !!terms && !!ctr && !!review &&
        Math.abs(searches.y - terms.y) < 5 && Math.abs(ctr.y - review.y) < 5 && terms.x > searches.x + searches.width && ctr.y > searches.y;
      return { pass, detail: pass ? "Same layout" : "Cards are not in the lesson's two-column layout" };
    });

    await c.check("Searches and Search click-through rate each show a 'yesterday' value and a line chart", async () => {
      const problems: string[] = [];
      for (const t of ["Searches", "Search click-through rate"]) {
        const stat = await card(page, t).locator('[data-testid="main-stat"]').innerText().catch(() => "");
        const chart = await card(page, t).locator('[data-testid="CustomLineGroup-LineSeries"]').count();
        if (!/yesterday/.test(stat) || !chart) problems.push(`${t}: ${/yesterday/.test(stat) ? "" : "no 'yesterday' value "}${chart ? "" : "no line chart"}`.trim());
      }
      return { pass: !problems.length, detail: problems.length ? problems.join("; ") : "Both present" };
    });

    await c.check("Test data: Most searched terms lists search terms with 'Appeared in N searches' and a View all link", async () => {
      const box = card(page, "Most searched terms");
      const empty = await box.locator('[data-testid="search-leaderboard-base-empty"]').count();
      const appeared = await box.getByText(/Appeared in \d+ search/).count();
      const viewAll = await box.getByText("View all", { exact: true }).isVisible().catch(() => false);
      const pass = !empty && appeared > 0 && viewAll;
      return { pass, detail: empty ? "No searches on the site in this period (empty state)" : `${appeared} terms, View all ${viewAll ? "present" : "missing"}` };
    });

    await c.check("Test data: Review these terms lists terms with 'No clicks in N searches'", async () => {
      const n = await card(page, "Review these terms").getByText(/No clicks in \d+ search/).count();
      return { pass: n > 0, detail: n ? `${n} terms` : "No terms listed (empty state)" };
    });
  },
});
