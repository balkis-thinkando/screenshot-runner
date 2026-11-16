// Lesson:  AUC-14381 - Create, share, and refine diagrams with Rovo
//          https://community.atlassian.com/learning/lesson/create-share-and-refine-diagrams-with-rovo
// Image:   #2, a Rovo-made whiteboard with Rovo Chat open, "Explore ideas" outlined
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT21BZJ.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT21BZJ'
// Test data: the brainstorming whiteboard in SyncUp (lib/confluence.ts ROVO_WHITEBOARD). "Explore ideas" only
// fills the prompt box; nothing is sent to Rovo.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideSidebar, openWhiteboard, ROVO_WHITEBOARD } from "../lib/confluence";
import { chatPanel, fakeGreeting, keepAgentIcons, openRovoChat } from "../lib/rovo";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const USER = FAKE_PEOPLE[0];
const explore = (page: Page) => page.locator(chatPanel).getByRole("button", { name: /Explore ideas/ }).or(page.locator(chatPanel).getByText("Explore ideas", { exact: true })).first();

runRecipe({
  file: "AUC-14381-2",
  assetId: "AT21BZJ",
  title: "AUC-14381 #2 - Whiteboard, Rovo Explore ideas",
  product: "confluence",

  async navigate(page, s) {
    await openWhiteboard(page, s);
    await openRovoChat(page);
    await explore(page).waitFor({ timeout: 30_000 });
    await explore(page).click();
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await keepAgentIcons(page);
    await fakeGreeting(page, USER.split(" ")[0]);
    await fakeSignedInUser(page, USER);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await hideSidebar(page);
    await spotlight(page, explore(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Whiteboard title, Edited time, Share and link buttons", async () => {
      const title = await page.getByText(ROVO_WHITEBOARD.title).evaluateAll((es) => es.some((e) => e.getBoundingClientRect().width > 0));
      const edited = await page.getByText(/^Edited /).first().isVisible();
      const share = await page.getByRole("button", { name: /^Share/ }).first().isVisible();
      return { pass: title && edited && share, detail: `Title: ${title}; Edited: ${edited}; Share: ${share}` };
    });

    await c.check("Rovo Chat greeting 'How can I help, ...?'", async () => {
      const g = await page.locator(chatPanel).getByText(/^How can I help, .+\?$/).first().isVisible();
      return { pass: g, detail: g ? "Present" : "Missing" };
    });

    await c.check("Whiteboard options: Generate diagram, Explore ideas", async () => {
      const gen = await page.locator(chatPanel).getByText("Generate diagram", { exact: true }).first().isVisible();
      const exp = await explore(page).isVisible();
      return { pass: gen && exp, detail: `Generate diagram: ${gen}; Explore ideas: ${exp}` };
    });

    await c.check("Context chip shows the whiteboard", async () => {
      const ctx = await page.locator(chatPanel).getByText(/Context:?/).first().isVisible();
      const name = await page.locator(chatPanel).getByText(/Product Development/).first().isVisible();
      return { pass: ctx && name, detail: `Context label: ${ctx}; whiteboard name: ${name}` };
    });

    await c.check("Explore ideas fills the prompt with 'Start exploration on this whiteboard about:'", async () => {
      const filled = await page.locator(chatPanel).getByText(/Start exploration on this whiteboard about:?/).first().isVisible();
      return { pass: filled, detail: filled ? "Prompt filled" : "Prompt text differs or empty" };
    });

  },
});
