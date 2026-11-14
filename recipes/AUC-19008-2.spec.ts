// Lesson:  AUC-19008 - What is Rovo Chat?
//          https://community.atlassian.com/learning/lesson/what-is-rovo-chat
// Image:   #2, section "Take actions directly in chat" (chat panel outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12OO0I.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12OO0I'
// Sends one prompt to Rovo on the TH board (owner OK, 13 Nov 2026); each run adds a chat to the test account's
// history. Nothing Rovo offers to do is accepted. The answer differs on every run, so it is masked and only its
// structure is checked.

import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { answerText, chatPanel, keepAgentIcons, newRovoChat, sendPrompt } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const PROMPT = "Suggest new work items for the remaining event tasks, and offer to create them";

runRecipe({
  file: "AUC-19008-2",
  assetId: "AT12OO0I",
  title: "AUC-19008 #2 - Rovo Chat offers actions",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/software/c/projects/TH/boards/182");
    await page.getByText(/^To Do/i).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
    await newRovoChat(page);
    await sendPrompt(page, PROMPT);
    // Show the end of the answer, where Rovo offers what it can do next, as in the lesson
    await page.locator(chatPanel).getByText(/I can|Would you like me to|Want me to/i).last().evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no tooltip left on the page
    await renameOrg(page, s.test_org, s.display_org_name);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await spotlight(page, page.locator(chatPanel), { markers: false });
  },

  // AI answer and board cards
  mask: (page) => [answerText(page), page.locator('[data-testid*="platform-card"], [data-component-selector*="card"]')],

  async checks(page, c) {
    await c.check("Answer ends with things Rovo can do next (suggested actions)", async () => {
      const offers = await page.locator(chatPanel).getByText(/I can|Would you like me to|Want me to/i).first().isVisible();
      return { pass: offers, detail: offers ? "Rovo offers actions" : "No offer of actions in this answer (AI output varies)" };
    });

    await c.check("Sources button under the answer", async () => {
      const sources = await page.locator(chatPanel).getByRole("button", { name: /Sources?$/ }).first().isVisible();
      return { pass: sources, detail: sources ? "Present" : "Missing" };
    });

    await c.check("Context chip shows the board", async () => {
      const ctx = await page.locator(chatPanel).getByText(/Context/).first().isVisible();
      return { pass: ctx, detail: ctx ? "Present" : "Missing" };
    });

    await c.check("Feedback buttons (Good response, Bad response)", async () => {
      const good = await page.locator(chatPanel).getByRole("button", { name: "Good response" }).last().isVisible();
      return { pass: good, detail: good ? "Present" : "Missing" };
    });
  },
});
