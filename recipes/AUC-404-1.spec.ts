// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #1, section "Enhance page headers" (page in view mode: header image above the title, emoji by the title)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/26u2q63v0p82807w3t5c836123j4dl48.png
// Recipe:  public.screenshot_recipes where asset_id = '26u2q63v0p82807w3t5c836123j4dl48'
// Opens a how-to page with a title emoji, sidebar hidden as in the lesson. Needs test data: no page on the site
// has both a header image and a title emoji (17 Nov 2026), so the header image check fails until one is added
// (then point EMOJI_PAGE in lib/b2-editor.ts at it). The author in the byline is a fake name.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openConfluencePage, hideSidebar } from "../lib/confluence";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { EMOJI_PAGE, fakeByline } from "../lib/b2-editor";

const title = (page: Page) => page.locator('[data-testid="title-text"]').first();

runRecipe({
  file: "AUC-404-1",
  assetId: "26u2q63v0p82807w3t5c836123j4dl48",
  title: "AUC-404 #1 - Page with header image and title emoji",
  product: "confluence",

  async navigate(page, s) {
    await openConfluencePage(page, s, EMOJI_PAGE.space, EMOJI_PAGE.id);
    await title(page).waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await hideSidebar(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[5]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "KC", FAKE_PEOPLE);
    await page.mouse.move(1279, 799);
  },

  // Read count and publish date change when someone views or edits the page
  mask: (page) => [page.locator('[data-testid="badge-style-analytics-byline"]'), page.getByText(/^(Published|Edited|Updated) /).first()],

  async checks(page, c) {
    await c.check("Header image above the title", async () => {
      const cover = await page.locator('[data-testid*="cover-picture"]').first().isVisible().catch(() => false);
      return { pass: cover, detail: cover ? "Present" : "No header image: needs test data (a page with a header image and a title emoji)" };
    });

    await c.check("Emoji next to the page title", async () => {
      const emoji = await page.locator('[data-testid="emoji-title"]').first().isVisible().catch(() => false);
      const t = (await title(page).innerText()).trim();
      return { pass: emoji && !!t, detail: `Emoji: ${emoji}; title: ${t}` };
    });

    await c.check("Byline: owner, last updated, read time, views", async () => {
      const text = (await page.locator('[data-testid="content-title-and-byline"]').first().innerText().catch(() => "")).replace(/\s+/g, " ");
      const has = { owner: /Owned by|By /.test(text), updated: /Last updated/.test(text), read: /min/.test(text) };
      return {
        pass: has.owner && has.updated && has.read,
        detail: `Owner: ${has.owner}; Last updated: ${has.updated}; read time: ${has.read}${has.updated ? "" : " (the byline is now one line: By <author>, read time, Listen, Add a reaction)"}`,
      };
    });

    await c.check("Page header actions: Edit, Share, Copy link, More actions", async () => {
      const want = ["Edit", "Share", "Copy link", "More actions"];
      const missing = [];
      for (const w of want) if (!(await page.getByRole("button", { name: w }).or(page.getByRole("link", { name: w })).first().isVisible().catch(() => false))) missing.push(w);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
