// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #4, section "Summary cards show features and admins."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ql5dn5e640qir0rp800d05jpkt54n6r0.png
// Recipe:  public.screenshot_recipes where asset_id = 'ql5dn5e640qir0rp800d05jpkt54n6r0'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, FAKE_PEOPLE, fakeProfileNames, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

const suggestions = '[data-testid="admin-center-suggestion-section"]';

// A summary card is a bordered card-container with an h3 title
const card = (page: Page, title: string) =>
  page.locator('[data-testid="card-container"]').filter({ has: page.locator("h3", { hasText: title }) }).first();
const LESSON_CARDS = ["External access features", "New features", "Confluence admins"];

runRecipe({
  file: "AUC-1748-4",
  assetId: "ql5dn5e640qir0rp800d05jpkt54n6r0",
  title: "AUC-1748 #4 - Mission control summary cards",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    // Fake names first, as in the lesson (Andrea Wilson, Orion Beck, Phil Mabrey); anonymize() then gives their pictures matching initials
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
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
