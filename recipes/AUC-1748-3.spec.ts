// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #3, section "Quickly take action with suggestions."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0w7204soj88xegu52658p24iiu332082.png
// Recipe:  public.screenshot_recipes where asset_id = '0w7204soj88xegu52658p24iiu332082'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

const missionControlLink = (page: Page) => page.locator(`${adminNav} a[data-testid="admin-center"]`);
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
}// One suggestion: icon, title (h4) and description, with an action button and a "..." menu on the right
const suggestionTitles = (page: Page) => page.locator(`${suggestions} h4`);
const LESSON_SUGGESTIONS = ["Manage your active, archived, and trashed spaces", "Check high-level permissions for users or groups"];

runRecipe({
  file: "AUC-1748-3",
  assetId: "0w7204soj88xegu52658p24iiu332082",
  title: "AUC-1748 #3 - Mission control suggestions",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await neutralPeople(page);
    await anonymize(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    // Scroll so the Suggestions section sits just below the top bar, as in the lesson
    await page.locator(mainContent).evaluate((m, sel) => {
      const top = document.querySelector(sel)!.getBoundingClientRect().top;
      m.scrollBy(0, top - 70);
    }, suggestions);
    await page.waitForTimeout(1_000);
    // Two outlined areas: Mission control in the sidebar and the Suggestions section
    await spotlightAreas(page, [missionControlLink(page), page.locator(suggestions)]);
  },

  // Which suggestions show (and their numbers) depends on the site; the summary cards below list people
  mask: (page) => [page.locator(`${suggestions} p, ${suggestions} [data-testid="SuggestionBase-description"]`), page.locator('[data-testid="admin-center.alerts-and-access-section"]')],

  async checks(page, c) {
    await c.check("Mission control section titled 'Suggestions'", async () => {
      const title = (await page.locator(suggestions).innerText()).split("\n")[0].trim();
      return { pass: title === "Suggestions", detail: `"${title}"` };
    });

    await c.check(`Suggestions include: ${LESSON_SUGGESTIONS.join(", ")}`, async () => {
      const titles = (await suggestionTitles(page).allInnerTexts()).map((t) => t.trim());
      const missing = LESSON_SUGGESTIONS.filter((t) => !titles.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}. Now: ${titles.join(", ")}` : "Both present" };
    });

    await c.check("Each lesson suggestion has a 'Try now' button and a more actions (...) menu", async () => {
      const problems: string[] = [];
      for (const t of LESSON_SUGGESTIONS) {
        // The suggestion row: the innermost element holding both the title and a "..." menu (last in page order)
        const row = page
          .locator(`${suggestions} *`)
          .filter({ has: page.locator("h4", { hasText: t }) })
          .filter({ has: page.getByRole("button", { name: "Suggestion more actions menu" }) })
          .last();
        if (!(await row.count())) { problems.push(`${t}: not found`); continue; }
        const tryNow = await row.getByRole("link", { name: "Try now", exact: true }).or(row.getByRole("button", { name: "Try now", exact: true })).first().isVisible();
        const more = await row.getByRole("button", { name: "Suggestion more actions menu" }).first().isVisible();
        if (!tryNow || !more) problems.push(`${t}: Try now ${tryNow ? "present" : "missing"}, menu ${more ? "present" : "missing"}`);
      }
      return { pass: !problems.length, detail: problems.length ? problems.join("; ") : "Both have Try now and a menu" };
    });

    await c.check("Test data: Suggestions show only the two lesson suggestions, in order", async () => {
      const titles = (await suggestionTitles(page).allInnerTexts()).map((t) => t.trim());
      const r = sameOrder(titles, LESSON_SUGGESTIONS);
      // An extra suggestion appears when the site has something to act on (e.g. content without active owners)
      return { pass: r.pass, detail: r.pass ? r.detail : `${r.detail} Extra suggestions come from site data.` };
    });
  },
});
