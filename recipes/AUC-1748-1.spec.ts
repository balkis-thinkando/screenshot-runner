// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #1, section "What is mission control?"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/081h2k0633jn6ew7s81vis4i3db0jb34.png
// Recipe:  public.screenshot_recipes where asset_id = '081h2k0633jn6ew7s81vis4i3db0jb34'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg } from "../lib/tweaks";

const missionControlLink = (page: Page) => page.locator(`${adminNav} a[data-testid="admin-center"]`);
// The bordered Overview card (h2 > title row > header > card)
const overviewCard = (page: Page) => page.locator("h2", { hasText: "Overview" }).first().locator("xpath=ancestor::div[3]");
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
}

runRecipe({
  file: "AUC-1748-1",
  assetId: "081h2k0633jn6ew7s81vis4i3db0jb34",
  title: "AUC-1748 #1 - Mission control page",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await neutralPeople(page);
    await anonymize(page);
    await renameOrg(page, s.test_org, s.display_org_name);
  },

  // The promotional banner, the overview numbers and the suggestions change over time
  mask: (page) => [
    page.locator('[data-testid="ga-space-roles-banner"]'),
    overviewCard(page).locator('[data-testid="main-stat"], [data-testid="footer-container"]'),
    page.locator(suggestions),
  ],

  async checks(page, c) {
    await c.check("Page title reads 'Mission control'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Mission control", detail: `"${h1}"` };
    });

    await c.check("Mission control is the selected item in the sidebar, under Monitoring", async () => {
      const current = await missionControlLink(page).getAttribute("aria-current");
      const link = await missionControlLink(page).boundingBox();
      const heading = await page.locator("#admin-navigation-monitoring-heading").boundingBox();
      const pass = current === "page" && !!link && !!heading && link.y > heading.y;
      return { pass, detail: `aria-current=${current}; ${heading ? "Monitoring heading present" : "no Monitoring heading"}` };
    });

    await c.check("Overview card: 'Overview' title, 'Refreshes daily' and an Edit button", async () => {
      const card = overviewCard(page);
      const refreshes = await card.getByText("Refreshes daily", { exact: true }).isVisible();
      const edit = await card.getByRole("button", { name: "Edit", exact: true }).isVisible();
      return { pass: refreshes && edit, detail: `Refreshes daily ${refreshes ? "present" : "missing"}, Edit ${edit ? "present" : "missing"}` };
    });

    await c.check("Overview metrics: Total spaces, Total content, Confluence searches", async () => {
      const titles = (await overviewCard(page).locator("h3").allInnerTexts()).map((t) => t.trim());
      const expected = ["Total spaces", "Total content", "Confluence searches"];
      const pass = JSON.stringify(titles) === JSON.stringify(expected);
      return { pass, detail: pass ? "Same metrics, same order" : `Now: ${titles.join(", ")}` };
    });

    await c.check("Suggestions section comes right below the Overview card", async () => {
      const ov = await overviewCard(page).boundingBox();
      const sug = await page.locator(suggestions).boundingBox();
      const title = (await page.locator(suggestions).innerText()).split("\n")[0].trim();
      const pass = !!ov && !!sug && sug.y > ov.y + ov.height && sug.y - (ov.y + ov.height) < 80 && title === "Suggestions";
      return { pass, detail: sug ? `Section titled "${title}", ${ov ? Math.round(sug.y - (ov.y + ov.height)) : "?"}px below Overview` : "No Suggestions section" };
    });
  },
});
