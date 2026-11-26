// Lesson:  AUC-413 - Adjust your personal settings in Confluence
//          https://community.atlassian.com/learning/lesson/adjust-your-personal-settings-in-confluence
// Image:   #1, section "Personalize your settings to make Confluence work for you" (space home, the profile menu
//          open and outlined, with markers on Profile, Personal space, Tasks, Personal settings and Log out)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/17g3nvc54eh745drtlk238784obvq687.png
// Recipe:  public.screenshot_recipes where asset_id = '17g3nvc54eh745drtlk238784obvq687'
// Opens the SyncUp space home and the profile menu (no item is clicked). The test account's name, email and
// picture are replaced by a fake person.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakePeopleLinks, fakeProfileEmail, itemTexts, missingFrom, openProfileMenu, openSpaceHome, profileMenu } from "../lib/b3-conf";

const PERSON = FAKE_PEOPLE[4];
const items = (page: Page) => profileMenu(page).locator('[role="menuitem"], a, button');
const marked = (page: Page) => items(page).filter({ hasText: /^\s*(Profile|Personal space|Tasks|Personal settings\b.*|Log out)\s*$/ });

runRecipe({
  file: "AUC-413-1",
  assetId: "17g3nvc54eh745drtlk238784obvq687",
  title: "AUC-413 #1 - Profile menu",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceHome(page, s);
    await openProfileMenu(page);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, PERSON);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await fakeProfileEmail(page, PERSON);
    await spotlight(page, profileMenu(page), { markersOn: marked(page), lineLengths: [0] });
    await page.mouse.move(1279, 799);
  },

  // Recent updates and page content behind the menu change
  mask: (page) => [page.locator("#AkMainContent")],

  async checks(page, c) {
    await c.check("Menu header: name and email", async () => {
      const t = await profileMenu(page).innerText();
      const email = /@/.test(t);
      return { pass: email, detail: email ? "Name and email shown" : "No email in the menu header" };
    });

    await c.check("Items: Profile, Account settings, Theme, Send feedback, Personal space, Tasks, Personal settings, Switch account, Log out", async () => {
      const have = await itemTexts(items(page));
      const want = ["Profile", "Account settings", "Theme", "Send feedback", "Personal space", "Tasks", "Personal settings", "Switch account", "Log out"];
      const missing = missingFrom(have, want);
      return { pass: !missing.length, detail: `Items: ${have.filter((h) => !h.includes("@")).join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Groups: Help us improve, Confluence", async () => {
      const t = await profileMenu(page).innerText();
      const help = /Help us improve/.test(t);
      const conf = /(^|\n)\s*Confluence\s*(\n|$)/.test(t);
      return { pass: help && conf, detail: `Help us improve: ${help}; Confluence: ${conf}` };
    });
  },
});
