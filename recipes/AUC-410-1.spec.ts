// Lesson:  AUC-410 - Manage pages in Confluence
//          https://community.atlassian.com/learning/lesson/manage-pages-in-confluence
// Image:   #1, section "What's the difference between deleting and archiving pages?" (page view, the More actions
//          menu open and outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/qw5333shm6j87083u0nva7nw8knu07y7.png
// Recipe:  public.screenshot_recipes where asset_id = 'qw5333shm6j87083u0nva7nw8knu07y7'
// Opens the SyncUp "Engineering onboarding guide" and its More actions menu (the lesson uses a Marketing page).
// No menu item is clicked. Owner and editor names in the byline are fake names.

import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { fakePeopleLinks, itemTexts, missingFrom, moreActionsMenu, openMoreActions, openPage } from "../lib/b3-conf";
import { fakeByline, hideBackToTop } from "../lib/b2-editor";

runRecipe({
  file: "AUC-410-1",
  assetId: "qw5333shm6j87083u0nva7nw8knu07y7",
  title: "AUC-410 #1 - Page More actions menu",
  product: "confluence",

  async navigate(page, s) {
    await openPage(page, s);
    await openMoreActions(page);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await hideBackToTop(page);
    await spotlight(page, moreActionsMenu(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  // Read count and dates in the byline change over time
  mask: (page) => [page.locator('[data-testid="badge-style-analytics-byline"]'), page.getByText(/^(Last updated|Published|Edited|Updated) |^Unpublished changes$/).first()],

  async checks(page, c) {
    const items = async () => itemTexts(moreActionsMenu(page).getByRole("menuitem"));

    await c.check("Archive and Delete in the menu (the lesson's topic)", async () => {
      const have = await items();
      const missing = missingFrom(have, ["Archive", "Delete"]);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Both present" };
    });

    await c.check("Menu items as in the lesson", async () => {
      const want = ["Duplicate", "Convert to live doc", "Move", "Export", "Convert to blog", "Convert to folder", "Archive", "Delete", "Presenter mode", "Apps", "Analytics", "Version history", "View ownership", "Attachments", "Resolved comments", "Advanced details"];
      const have = await items();
      const missing = missingFrom(have, want);
      const added = have.filter((h) => !want.some((w) => h.startsWith(w)));
      return {
        pass: !missing.length,
        detail: `Items: ${have.join(", ")}${missing.length ? `. Missing or renamed: ${missing.join(", ")}` : ""}${added.length ? `. Not in the lesson: ${added.join(", ")}` : ""}`,
      };
    });
  },
});
