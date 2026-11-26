// Lesson:  AUC-413 - Adjust your personal settings in Confluence
//          https://community.atlassian.com/learning/lesson/adjust-your-personal-settings-in-confluence
// Image:   #4, section "Stop watching certain spaces and pages" (personal settings, Watches tab: Space Watches and
//          Content Watches lists; the Stop Watching links outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/7ev3ikt8oc6ruruesih1d4p1a58377xp.png
// Recipe:  public.screenshot_recipes where asset_id = '7ev3ikt8oc6ruruesih1d4p1a58377xp'
// Opens the test account's personal settings and its Watches tab. No Stop Watching link is clicked. What the
// account watches is its own history, so the lists are masked; the account name is a fake name.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, fakePeopleLinks, openWikiPath } from "../lib/b3-conf";

const content = (page: Page) => page.locator("#content, #main, body").first();
const tab = (page: Page) => content(page).getByRole("link", { name: "Watches", exact: true }).first();
const stops = (page: Page) => content(page).getByRole("link", { name: /^Stop Watching$/i }).or(content(page).getByRole("button", { name: /^Stop Watching$/i }));

runRecipe({
  file: "AUC-413-4",
  assetId: "7ev3ikt8oc6ruruesih1d4p1a58377xp",
  title: "AUC-413 #4 - Personal settings Watches",
  product: "confluence",

  async navigate(page, s) {
    await openWikiPath(page, s, "/users/viewmyemailsettings.action", tab(page), "personal settings");
    await tab(page).click();
    await content(page).getByText(/Space Watches|Content Watches/).first().waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    const visible = [];
    for (const l of await stops(page).all()) {
      const b = await l.boundingBox();
      if (b && b.y + b.height < 800) visible.push(l);
    }
    if (visible.length) await dimAreas(page, [visible]);
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [content(page).locator("table")],

  async checks(page, c) {
    await c.check("Tabs: Personal settings, Tasks, Saved for later, Watches, Network", async () => {
      const missing = [];
      for (const w of ["Personal settings", "Tasks", "Saved for later", "Watches", "Network"]) if (!(await content(page).getByRole("link", { name: w, exact: true }).first().isVisible().catch(() => false))) missing.push(w);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Space Watches and Content Watches sections", async () => {
      const sp = await content(page).getByText("Space Watches", { exact: true }).first().isVisible().catch(() => false);
      const co = await content(page).getByText("Content Watches", { exact: true }).first().isVisible().catch(() => false);
      return { pass: sp && co, detail: `Space Watches: ${sp}; Content Watches: ${co}` };
    });

    await c.check("Watched items with a Stop Watching link (test data)", async () => {
      const n = await stops(page).count();
      return { pass: n >= 3, detail: n ? `${n} Stop Watching links` : "Nothing watched: needs test data (the account should watch a space and a few pages)" };
    });
  },
});
