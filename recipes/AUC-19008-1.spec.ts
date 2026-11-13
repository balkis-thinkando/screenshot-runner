// Lesson:  AUC-19008 - What is Rovo Chat?
//          https://community.atlassian.com/learning/lesson/what-is-rovo-chat
// Image:   #1, section "Get contextual answers and insights" (chat panel outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12OO0J.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12OO0J'
// Sends one prompt to Rovo on a Confluence page (owner OK, 13 Nov 2026); each run adds a chat to the test
// account's history. The answer is written by AI and differs on every run, so it is masked and only its
// structure is checked.

import { runRecipe } from "../lib/recipe";
import { hideSidebar, openConfluencePage, ROVO_PAGE } from "../lib/confluence";
import { answerText, chatHeader, chatPanel, keepAgentIcons, newRovoChat, sendPrompt } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const PROMPT = "Summarize this page";

runRecipe({
  file: "AUC-19008-1",
  assetId: "AT12OO0J",
  title: "AUC-19008 #1 - Rovo Chat summarizes a page",
  product: "confluence",

  async navigate(page, s) {
    await openConfluencePage(page, s, ROVO_PAGE.space, ROVO_PAGE.id);
    await newRovoChat(page);
    await sendPrompt(page, PROMPT);
    // Show the answer from the top: the prompt, then the summary, as in the lesson
    await page.locator(chatPanel).getByText(PROMPT, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await page.mouse.move(640, 790);
    await renameOrg(page, s.test_org, s.display_org_name);
    const author = (await page.getByText(/^By .+/).first().innerText().catch(() => "")).replace(/^By /, "").trim();
    if (author) await renameOrg(page, author, FAKE_PEOPLE[0]);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await hideSidebar(page);
    await spotlight(page, page.locator(chatPanel), { markers: false });
  },

  mask: (page) => [answerText(page)],

  async checks(page, c) {
    await c.check("Ask Rovo opens Rovo Chat beside the page, with Rovo selected", async () => {
      const header = (await page.locator(chatHeader).innerText()).includes("Rovo");
      return { pass: header, detail: header ? "Rovo Chat open" : "Chat panel not found" };
    });

    await c.check("The prompt shows as a message in the chat", async () => {
      const shown = await page.locator(chatPanel).getByText(PROMPT, { exact: true }).first().isVisible();
      return { pass: shown, detail: shown ? "Shown" : "Missing" };
    });

    await c.check("Answer shows the steps Rovo took ('Completed N steps' or 'Thinking completed')", async () => {
      const steps = await page.locator(chatPanel).getByText(/^(Completed \d+ steps?|Thinking completed)$/).first().isVisible();
      return { pass: steps, detail: steps ? "Present" : "Missing" };
    });

    await c.check("Answer is a summary with headings or text", async () => {
      const n = await answerText(page).count();
      return { pass: n > 2, detail: `${n} text blocks` };
    });

    await c.check("Prompt box 'Describe what you want to know or do next' and 'Uses AI. Verify results.'", async () => {
      const box = await page.locator(chatPanel).getByText(/Describe what you want to know or do next/).first().isVisible();
      const ai = await page.locator(chatPanel).getByText(/Uses AI\. Verify results/).first().isVisible();
      return { pass: box && ai, detail: `Prompt box: ${box}; Uses AI: ${ai}` };
    });
  },
});
