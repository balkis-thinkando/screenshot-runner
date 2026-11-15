// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #1, section "What is mission control?"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/081h2k0633jn6ew7s81vis4i3db0jb34.png
// Recipe:  public.screenshot_recipes where asset_id = '081h2k0633jn6ew7s81vis4i3db0jb34'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, FAKE_PEOPLE, fakeProfileNames, hideMessages, renameOrg } from "../lib/tweaks";

const missionControlLink = (page: Page) => page.locator(`${adminNav} a[data-testid="admin-center"]`);
// The bordered Overview card (h2 > title row > header > card)
const overviewCard = (page: Page) => page.locator("h2", { hasText: "Overview" }).first().locator("xpath=ancestor::div[3]");
const suggestions = '[data-testid="admin-center-suggestion-section"]';


runRecipe({
  file: "AUC-1748-1",
  assetId: "081h2k0633jn6ew7s81vis4i3db0jb34",
  title: "AUC-1748 #1 - Mission control page",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    // Fake names first, as in the lesson (Andrea Wilson, Orion Beck, Phil Mabrey); anonymize() then gives their pictures matching initials
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
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
