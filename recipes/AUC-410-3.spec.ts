// Lesson:  AUC-410 - Manage pages in Confluence
//          https://community.atlassian.com/learning/lesson/manage-pages-in-confluence
// Image:   #3, section "View page analytics" (Page analytics, Overview tab: Engagement overview with date ranges,
//          Total views, Unique viewers, Mentioned users and the views chart)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ll7t0uqy5u50bged2372q068u0b2y0ju
// Recipe:  public.screenshot_recipes where asset_id = 'll7t0uqy5u50bged2372q068u0b2y0ju'
// Opens the analytics page of the SyncUp "Engineering onboarding guide" (/wiki/spaces/SyncUp/analytics/<id>/overview).
// The lesson reaches it from More actions > Analytics; that item is no longer in the menu (Nov 2026): the page is
// now reached from the views icon in the byline > "View more insights" (AUC-410 #1 checks the menu).
// Counts and the chart change with every view, so they are masked.

import { Page } from "@playwright/test";
import { hideSidebar } from "../lib/confluence";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { fakePeopleLinks, openWikiPath, PAGE } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent, main").first();
const has = (page: Page, t: string | RegExp) => main(page).getByText(t).first().isVisible().catch(() => false);

runRecipe({
  file: "AUC-410-3",
  assetId: "ll7t0uqy5u50bged2372q068u0b2y0ju",
  title: "AUC-410 #3 - Page analytics overview",
  product: "confluence",

  async navigate(page, s) {
    await openWikiPath(page, s, `/spaces/${PAGE.space}/analytics/${PAGE.id}/overview`, main(page).getByText(/Engagement overview|Page analytics/).first(), "page analytics");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(3_000);
  },

  async tweak(page, s) {
    // The lesson shows the page without the sidebar (full-width chart)
    await hideSidebar(page).catch(() => {});
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await page.mouse.move(1279, 799);
  },

  // Numbers, dates and the chart change with every view
  mask: (page) => [main(page).locator("svg, canvas"), main(page).getByText(/^\d+$/), main(page).getByText(/Up from|Down from|No change/)],

  async checks(page, c) {
    await c.check("Page analytics heading with Overview and Mentions tabs", async () => {
      const h = await has(page, "Page analytics");
      const ov = await main(page).getByRole("tab", { name: "Overview" }).isVisible().catch(() => false);
      const me = await main(page).getByRole("tab", { name: "Mentions" }).isVisible().catch(() => false);
      return { pass: h && ov && me, detail: `Heading: ${h}; Overview: ${ov}; Mentions: ${me}` };
    });

    await c.check("Engagement overview with 7D, 1M, 3M, YTD, All-time and Reset all", async () => {
      const eo = await has(page, "Engagement overview");
      const missing = [];
      for (const r of ["7D", "1M", "3M", "YTD", "All-time", "Reset all"]) if (!(await main(page).getByRole("button", { name: r, exact: true }).or(main(page).getByRole("radio", { name: r })).first().isVisible().catch(() => false))) missing.push(r);
      const now = (await main(page).getByRole("button").allInnerTexts()).map((t) => t.trim()).filter((t) => /viewers|months|days|year|time/i.test(t) && t.length < 30);
      return {
        pass: eo && !missing.length,
        detail: `Engagement overview: ${eo}${missing.length ? `; missing: ${missing.join(", ")}; drop-downs now: ${now.join(", ") || "none"}` : "; all ranges present"}`,
      };
    });

    await c.check("Cards: Total views, Unique viewers, Mentioned users", async () => {
      const missing = [];
      for (const t of ["Total views", "Unique viewers", "Mentioned users"]) if (!(await has(page, t))) missing.push(t);
      const renamed = missing.includes("Mentioned users") && (await has(page, "Mentioned people and agents")) ? " (now 'Mentioned people and agents')" : "";
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}${renamed}` : "All present" };
    });

    await c.check("Chart legend: Total views, Unique viewers, Engaged views, Engaged viewers", async () => {
      const missing = [];
      for (const t of ["Engaged views", "Engaged viewers"]) if (!(await has(page, t))) missing.push(t);
      const renamed = missing.includes("Engaged viewers") && (await has(page, "Engaged users")) ? " (now 'Engaged users')" : "";
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}${renamed}` : "All present" };
    });
  },
});
