// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #2, the agent's page in Studio with the Test chat open (conversation starters)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/o437lkb1i785s5ys802ksd75f8ycjqf5.png
// Recipe:  public.screenshot_recipes where asset_id = 'o437lkb1i785s5ys802ksd75f8ycjqf5'
// Test data: the "DACI Document Assistant" agent owned by the test account (lib/studio.ts). Test only opens the
// chat; nothing is sent. Learners' Studio may show a different layout than the test account's.

import { runRecipe } from "../lib/recipe";
import { agentHeading, collapseStudioSidebar, DACI_AGENT, openAgentInStudio, keepStudioAgentIcons } from "../lib/studio";
import { Page } from "@playwright/test";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE } from "../lib/tweaks";

// Studio's Test chat (not the Jira/Confluence side panel): its empty state holds the intro and starters
const intro = (page: Page) => page.locator('[data-testid="rovo-agent-empty-state"]');
const starterButtons = (page: Page) => page.locator('[data-testid^="rovo-agent-conversation-starter-"]');

runRecipe({
  file: "AUC-498-2",
  assetId: "o437lkb1i785s5ys802ksd75f8ycjqf5",
  title: "AUC-498 #2 - Custom agent page with Test chat",
  product: "jira",

  async navigate(page, s) {
    await openAgentInStudio(page, s, "details");
    await collapseStudioSidebar(page);
    await page.getByRole("button", { name: "Test", exact: true }).click();
    await starterButtons(page).first().waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799); // the agent's hover card opens under the mouse
    await page.waitForTimeout(2_000);
  },

  async tweak(page) {
    await keepStudioAgentIcons(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
  },

  async checks(page, c) {
    await c.check("Header: agent name with Published and version V1 lozenges", async () => {
      const header = (await agentHeading(page).locator("xpath=ancestor::*[3]").innerText()).replace(/\s+/g, " ");
      const ok = header.includes("Published") && /\bV1\b/.test(header);
      return { pass: ok, detail: header.slice(0, 120) };
    });

    await c.check("Header buttons: Test, Edit, More", async () => {
      const test = await page.getByRole("button", { name: "Test", exact: true }).isVisible();
      const edit = await page.getByRole("button", { name: "Edit", exact: true }).isVisible();
      return { pass: test && edit, detail: `Test: ${test}; Edit: ${edit}` };
    });

    await c.check("Instructions section with the agent's instructions", async () => {
      const label = await page.getByText("Instructions", { exact: true }).first().isVisible();
      const text = await page.getByText(/You are a DACI Document Assistant/).first().isVisible();
      return { pass: label && text, detail: `Label: ${label}; text: ${text}` };
    });

    await c.check("Test chat: agent selected in the chat header", async () => {
      const title = page.locator('[data-testid="rovo-chat-header-container"] [data-testid="agent-title-pressable"]');
      const ok = (await title.innerText().catch(() => "")).includes("DACI Document");
      return { pass: ok, detail: ok ? "Agent shown" : "Agent not in the chat header" };
    });

    await c.check("Test chat: version picker 'V1 Published' under the description", async () => {
      const v = await intro(page).getByText(/^V1$/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "No version picker in the chat" };
    });

    await c.check("Test chat: the agent's three conversation starters", async () => {
      const shown = [];
      const texts = (await starterButtons(page).allInnerTexts()).map((t) => t.trim());
      for (const t of DACI_AGENT.starters) shown.push(texts.includes(t));
      return { pass: shown.every(Boolean), detail: `${shown.filter(Boolean).length} of 3 shown` };
    });

    await c.check("Prompt box: 'Describe what you want to know or do next'", async () => {
      const box = await page.getByText(/Describe what you want to know or do next/).first().isVisible();
      return { pass: box, detail: box ? "Same placeholder" : "Placeholder changed" };
    });
  },
});
