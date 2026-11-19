// Lesson:  AUC-12905 - AI best practices for companies and leaders
//          https://community.atlassian.com/learning/lesson/how-to-use-ai-in-business
// Image:   #1, section "Company-wide best practices for AI": a user searches "Does Jira allow me to color code
//          my work items?" in Confluence and Rovo answers above the results (search bar and answer outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/k2pc845v2x04seqy0352ea81f03l7uqw.png
// Recipe:  public.screenshot_recipes where asset_id = 'k2pc845v2x04seqy0352ea81f03l7uqw'
// Opens the search page for the question (sending a search question to Rovo is owner approved), expands the
// answer (Show more, display only) and scrolls to its end, where the sources, the AI notice, the feedback
// buttons and the follow-up box are. The lesson image shows a real person's name in a result byline: every
// person on the page gets a fake name. The AI text and the results are masked.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { answerCard, answerHeading, fakePersonalSpaces, hideRovoNudge, searchBox, openSearchPage, searchInput, waitForAnswer } from "../lib/b2-search";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const QUERY = "Does Jira allow me to color code my work items?";
const sources = (page: Page) => page.getByTestId("sources-bar-button");
const followUp = (page: Page) => page.getByTestId("lumina-input-to-chat-submit");

/** The answer card, marked in navigate() before it was expanded; falls back to answerCard(). */
const card = (page: Page) => page.locator("[data-screenshot-answer-card]").or(answerCard(page)).first();

runRecipe({
  file: "AUC-12905-1",
  assetId: "k2pc845v2x04seqy0352ea81f03l7uqw",
  title: "AUC-12905 #1 - Rovo answer to a search question",
  product: "confluence",

  async navigate(page, s) {
    // Rovo answer, Show more and scroll can exceed the default 120s in CI (no result was recorded in run #36)
    test.setTimeout(240_000);
    await openSearchPage(page, s, QUERY);
    await waitForAnswer(page);
    // A short answer has no "Show more", and the buttons can render late: unbounded waits here ran the test
    // into its time limit in CI (SHOT-102, SHOT-110). Every wait is bounded; missing parts fail the checks instead.
    // Expanded, the card has no "Show less" button, so answerCard() no longer finds it: mark it first
    await answerCard(page).evaluate((el) => el.setAttribute("data-screenshot-answer-card", ""), undefined, { timeout: 10_000 }).catch(() => {});
    const more = card(page).getByRole("button", { name: "Show more" });
    if (await more.isVisible().catch(() => false) || (await more.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))) {
      await more.click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(2_000);
    }
    const likeButton = page.getByTestId("ai-answer-like-button");
    await likeButton.waitFor({ timeout: 20_000 }).catch(() => {});
    // The end of the answer near the bottom of the window
    if (await likeButton.isVisible()) await likeButton.evaluate((el) => {
      let box = el.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      const target = box ?? document.scrollingElement!;
      target.scrollTop += el.getBoundingClientRect().bottom - (innerHeight - 220);
    });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await hideRovoNudge(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakePersonalSpaces(page);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    // The answer runs past the top of the window: outline its visible part, down to the AI notice and buttons
    const cardBox = await card(page).boundingBox({ timeout: 5_000 }).catch(() => null);
    const like = await page.getByTestId("ai-answer-like-button").boundingBox({ timeout: 5_000 }).catch(() => null);
    const filters = await page.getByTestId("filter-all").boundingBox({ timeout: 5_000 }).catch(() => null);
    if (cardBox && like && filters) {
      await page.evaluate(([c, l, f]) => {
        const top = Math.max(c.y, f.y + f.height + 16);
        const d = document.createElement("div");
        d.id = "screenshot-answer-box";
        d.dataset.screenshotMask = "answer";
        Object.assign(d.style, { position: "fixed", left: `${c.x}px`, top: `${top}px`, width: `${c.width}px`, height: `${l.y + l.height - top}px`, pointerEvents: "none" });
        document.body.appendChild(d);
      }, [cardBox, like, filters] as const);
      await spotlightAreas(page, [await searchBox(page), page.locator("#screenshot-answer-box")]);
    }
  },

  // Rovo's answer changes on every run; so do the results below it
  mask: (page) => [page.locator('[data-screenshot-mask="answer"]'), card(page)],

  async checks(page, c) {
    await c.check("Search bar shows the question", async () => {
      const v = await searchInput(page).inputValue();
      return { pass: v === QUERY, detail: `"${v}"` };
    });

    await c.check("Rovo answer card above the results", async () => {
      const heading = (await answerHeading(page).innerText({ timeout: 5_000 }).catch(() => "")).trim();
      const len = (await card(page).innerText({ timeout: 5_000 }).catch(() => "")).length;
      return { pass: len > 200, detail: `Heading "${heading}" (lesson: "Answer"); ${len} characters` };
    });

    await c.check("Sources shown under the answer as cards with Copy link", async () => {
      const cards = await page.getByRole("button", { name: "Copy link" }).count();
      const bar = (await sources(page).innerText({ timeout: 5_000 }).catch(() => "")).replace(/\s+/g, " ").trim();
      const related = await page.getByText("Related links", { exact: true }).first().isVisible().catch(() => false);
      return {
        pass: cards > 0,
        detail: cards > 0 ? `${cards} source cards` : `No source cards with Copy link; sources are now ${related ? "a 'Related links' list and " : ""}a "${bar || "?"}" bar`,
      };
    });

    await c.check("'Uses AI. Verify results.' with like, dislike and copy buttons", async () => {
      const uses = await page.getByText(/Uses AI\. Verify results\./).first().isVisible();
      const btns = await Promise.all(["ai-answer-like-button", "ai-answer-dislike-button", "copy-button"].map((id) => page.getByTestId(id).first().isVisible()));
      return { pass: uses && btns.every(Boolean), detail: `Uses AI: ${uses}; like/dislike/copy: ${btns.join("/")}` };
    });

    await c.check("Follow-ups: 'Open chat' and suggested questions", async () => {
      const open = await page.getByRole("button", { name: /^Open chat$/ }).isVisible().catch(() => false);
      const box = await followUp(page).isVisible().catch(() => false);
      return { pass: open, detail: open ? "Present" : box ? "Replaced by a follow-up question box that sends to Rovo Chat" : "No follow-up controls" };
    });
  },
});
