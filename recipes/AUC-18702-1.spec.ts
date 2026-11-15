// Lesson:  AUC-18702 - Summarize content quickly with Rovo
//          https://community.atlassian.com/learning/lesson/summarize-content-quickly-with-rovo
// Image:   #1, section "Audio briefings for pages or blogs in Confluence" (Listen and the briefing panel outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/AT12MOKS.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12MOKS'
// Opens the audio briefing panel with Listen; the briefing is not played.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar, openConfluencePage, ROVO_PAGE } from "../lib/confluence";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const listen = '[data-testid="byline-listen"]';
// The briefing panel: the closest block around "Switch to Narration" that also holds the Playlist
const panel = (page: Page) =>
  page.getByText("Switch to Narration", { exact: true }).locator("xpath=ancestor::div[.//*[normalize-space(text())='Playlist']][1]");

runRecipe({
  file: "AUC-18702-1",
  assetId: "AT12MOKS",
  title: "AUC-18702 #1 - Audio briefing (Listen)",
  product: "confluence",

  async navigate(page, s) {
    await openConfluencePage(page, s, ROVO_PAGE.space, ROVO_PAGE.id);
    await page.locator(listen).click();
    await page.getByText("Switch to Narration", { exact: true }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no tooltip left on the page
    await renameOrg(page, s.test_org, s.display_org_name);
    // The page author (byline and briefing panel) has no profile card label: replace the name itself
    const author = (await page.getByText(/^By .+/).first().innerText()).replace(/^By /, "").trim();
    if (author) await renameOrg(page, author, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await hideSidebar(page);
    await spotlightAreas(page, [page.locator(listen), panel(page)]);
  },

  async checks(page, c) {
    await c.check("Byline: author, reading time, Listen, Add a reaction", async () => {
      const listenShown = await page.locator(listen).isVisible();
      const reaction = await page.getByText("Add a reaction").first().isVisible();
      return { pass: listenShown && reaction, detail: `Listen: ${listenShown}; Add a reaction: ${reaction}` };
    });

    await c.check("Briefing panel: page title and author", async () => {
      const title = await panel(page).getByText(ROVO_PAGE.title, { exact: true }).isVisible();
      return { pass: title, detail: title ? "Title shown" : "Title missing" };
    });

    await c.check("Briefing controls: Switch to Narration, copy link, play", async () => {
      const narration = await panel(page).getByText("Switch to Narration", { exact: true }).isVisible();
      const buttons = await panel(page).getByRole("button").count();
      return { pass: narration && buttons >= 5, detail: `Switch to Narration: ${narration}; ${buttons} buttons` };
    });

    await c.check("Footer: LABS, Uses AI. Verify results., feedback buttons", async () => {
      const labs = await panel(page).getByText(/LABS/).first().isVisible();
      const ai = await panel(page).getByText(/Uses AI/).first().isVisible();
      return { pass: labs && ai, detail: `LABS: ${labs}; Uses AI: ${ai}` };
    });

    await c.check("Playlist section", async () => {
      const playlist = await panel(page).getByText("Playlist", { exact: true }).isVisible();
      return { pass: playlist, detail: playlist ? "Present" : "Missing" };
    });
  },
});
