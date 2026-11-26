// Lesson:  AUC-413 - Adjust your personal settings in Confluence
//          https://community.atlassian.com/learning/lesson/adjust-your-personal-settings-in-confluence
// Image:   #2, section "Update your profile" (the account's Confluence profile page, with the profile menu open and
//          its Profile item outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/u00cqs0do0o8arbnu7s0s51co65gkmk0.png
// Recipe:  public.screenshot_recipes where asset_id = 'u00cqs0do0o8arbnu7s0s51co65gkmk0'
// Opens Confluence home, the profile menu and its Profile item (a link), then opens the profile menu again on the
// profile page. Nothing is edited. Since Nov 2026 the Profile item (and /wiki/people/<id>) opens the Atlassian Home
// profile (home.atlassian.com), not a Confluence page: the recipe follows it and the checks say so. The account's
// name, email and picture are replaced by a fake person. Test data: the test account has no role details (job
// title, department, organization, location), which the lesson's profile shows.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, hideMessages, renameOrg, spotlight } from "../lib/tweaks";
import { fakeProfileEmail, openProfileMenu, openWikiPath, profileButton } from "../lib/b3-conf";

const PERSON = FAKE_PEOPLE[4];
const profileItem = (page: Page) =>
  page.locator('[role="menu"], [role="dialog"], [data-testid*="profile"]').getByRole("menuitem", { name: /^Profile$/ }).or(page.getByRole("link", { name: /^Profile$/ })).first();
const body = (page: Page) => page.locator("body");

runRecipe({
  file: "AUC-413-2",
  assetId: "u00cqs0do0o8arbnu7s0s51co65gkmk0",
  title: "AUC-413 #2 - Profile page and Profile menu item",
  product: "confluence",

  async navigate(page, s) {
    await openWikiPath(page, s, "/home", profileButton(page), "Confluence home");
    await openProfileMenu(page);
    await profileItem(page).click();
    await page.waitForURL(/\/people\//, { timeout: 60_000 });
    await page.locator(":is(h1, h2, h3, button):visible", { hasText: /Worked on|Frequent spaces|Recent work|Add role details|Manage your account/ }).first().waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    // The profile menu of the page the Profile item opened (Confluence or Atlassian Home)
    await profileButton(page).click();
    await profileItem(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    // Headless Chromium gets an "Apologies, this site doesn't work on your browser" banner on Atlassian Home
    await hideMessages(page, ["Apologies, this site"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    // Not fakePeopleLinks(): on Atlassian Home the sidebar and the menu's Profile item are /people/ links too
    await fakeSignedInUser(page, PERSON);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await fakeProfileEmail(page, PERSON);
    await spotlight(page, profileItem(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  // What the account worked on and its frequent spaces depend on its history
  mask: (page) => [body(page).getByText(/^(Worked on|Frequent spaces|Recent work)$/).locator("xpath=../..").first()],

  async checks(page, c) {
    await c.check("Profile opens the Confluence profile page", async () => {
      const host = new URL(page.url()).hostname;
      const conf = host.endsWith(".atlassian.net");
      return { pass: conf, detail: conf ? "Confluence profile" : `Now opens the Atlassian Home profile (${host})` };
    });

    await c.check("Profile page: Worked on list", async () => {
      const w = await body(page).getByText("Worked on", { exact: true }).first().isVisible().catch(() => false);
      const recent = await body(page).getByText(/^(Recent work|Frequent spaces)$/).first().innerText().catch(() => "");
      return { pass: w, detail: w ? "Present" : `No 'Worked on' list${recent ? ` (the page shows '${recent.trim()}')` : ""}` };
    });

    await c.check("About: job title, department, organization, location (test data)", async () => {
      const add = await body(page).getByRole("button", { name: /Add role details/ }).first().isVisible().catch(() => false);
      return { pass: !add, detail: add ? "Empty: 'Add role details' shown, needs test data (a job title, department, organization and location on the test account)" : "Filled in" };
    });

    await c.check("Profile item in the profile menu", async () => {
      const v = await profileItem(page).isVisible();
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
