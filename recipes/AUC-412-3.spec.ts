// Lesson:  AUC-412 - Search for information in Confluence
//          https://community.atlassian.com/learning/lesson/search-in-confluence
// Image:   #3, section "Use Rovo to search with natural language": the question "How do I prepare for a
//          software launch?" searched, with Rovo's answer above the results (search bar and answer outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT1VNBA.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1VNBA'
// Opens the search page for the question (sending a search question to Rovo is owner approved). The answer
// stays collapsed as in the lesson. The AI text and the results below it are masked.

import { runRecipe } from "../lib/recipe";
import { answerCard, answerHeading, fakePersonalSpaces, hideRovoNudge, searchBox, markResultsArea, openSearchPage, searchInput, waitForAnswer } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const QUERY = "How do I prepare for a software launch?";

runRecipe({
  file: "AUC-412-3",
  assetId: "AT1VNBA",
  title: "AUC-412 #3 - Rovo answer in search",
  product: "confluence",

  async navigate(page, s) {
    await openSearchPage(page, s, QUERY);
    await waitForAnswer(page);
    await page.mouse.move(1279, 799);
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await hideRovoNudge(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakePersonalSpaces(page);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await markResultsArea(page, answerHeading(page));
    await spotlightAreas(page, [await searchBox(page), [answerCard(page), answerCard(page).getByRole("button", { name: "Show more" })]]);
  },

  // Rovo's answer and the results below it change on every run
  mask: (page) => [page.locator('[data-screenshot-mask="results"]')],

  async checks(page, c) {
    await c.check("Search bar shows the question", async () => {
      const v = await searchInput(page).inputValue();
      return { pass: v === QUERY, detail: `"${v}"` };
    });

    await c.check("Rovo answer card above the results", async () => {
      const card = await answerCard(page).isVisible();
      const len = (await answerCard(page).innerText().catch(() => "")).length;
      return { pass: card && len > 100, detail: card ? `Answer shown (${len} characters)` : "No answer card" };
    });

    await c.check("Card heading 'Answer' with a 'Read more' link", async () => {
      const heading = (await answerHeading(page).innerText()).trim();
      const more = (await answerCard(page).getByRole("button", { name: /^(Show more|Read more)$/ }).or(answerCard(page).getByRole("link", { name: /^Read more$/ })).first().innerText().catch(() => "")).trim();
      const same = heading === "Answer" && more === "Read more";
      return { pass: same, detail: same ? "Same" : `Heading now "${heading}", expand control now "${more || "none"}"` };
    });

    await c.check("Footer: 'Uses AI. Verify results.' with like, dislike and copy", async () => {
      const uses = await answerCard(page).getByText(/Uses AI\. Verify results\./).isVisible().catch(() => false);
      const like = await page.getByTestId("ai-answer-like-button").isVisible().catch(() => false);
      const copy = await page.getByTestId("copy-button").first().isVisible().catch(() => false);
      return { pass: uses && like && copy, detail: uses || like || copy ? `Uses AI: ${uses}; like: ${like}; copy: ${copy}` : "Not shown while the answer is collapsed (only after Show more)" };
    });

    await c.check("Filter bar above the answer (App, Space)", async () => {
      const app = await page.getByTestId("filter-all").isVisible();
      const space = await page.getByTestId("search-dialog-space-filter-button").isVisible();
      return { pass: app && space, detail: `App tabs: ${app}; Space: ${space}` };
    });
  },
});
