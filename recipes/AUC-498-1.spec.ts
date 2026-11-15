// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #1, section "Consider duplicating an existing Agent" (agent card and its menu outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/3j5a30bbmo805tg26nf8lea5g704j6v8.png
// Recipe:  public.screenshot_recipes where asset_id = '3j5a30bbmo805tg26nf8lea5g704j6v8'
// The menu is only opened; Duplicate agent is not clicked. The test account is an org admin, so the menu also
// shows Verify, Edit and Delete agent, which learners don't see.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { agentsDialog, fakeGreeting, keepAgentIcons, openAgentsDialog, openRovoChat } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const firstCard = (page: Page) => page.locator(`${agentsDialog} [data-testid^="browse-agent--"][aria-label]`).first();
const menu = (page: Page) => page.getByRole("menu").or(page.locator('[role="menu"], [data-testid*="dropdown-menu"]')).last();

runRecipe({
  file: "AUC-498-1",
  assetId: "3j5a30bbmo805tg26nf8lea5g704j6v8",
  title: "AUC-498 #1 - Agent card menu, Duplicate agent",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/for-you");
    await openRovoChat(page);
    await openAgentsDialog(page);
    // Recommended tab: open More actions on the first recommended agent
    const name = await firstCard(page).getAttribute("aria-label");
    await page.locator(agentsDialog).getByRole("button", { name: `More actions for ${name}` }).first().click();
    await menu(page).getByText("Duplicate agent").waitFor({ timeout: 15_000 });
    // Opening the menu can scroll the list a little; show it from the top, as in the lesson
    await page.locator(`${agentsDialog} [data-testid="modal-dialog--scrollable"]`).evaluate((el) => (el.scrollTop = 0)).catch(() => {});
    await page.waitForTimeout(800);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeGreeting(page, FAKE_PEOPLE[5].split(" ")[0]);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await spotlightAreas(page, [[firstCard(page), menu(page)]]);
  },

  // Which agents are recommended depends on the account
  mask: (page) => [page.locator(`${agentsDialog} [data-testid^="browse-agent--"][aria-label]`)],

  async checks(page, c) {
    await c.check("Dialog 'Agents for every team'", async () => {
      const h = await page.locator(agentsDialog).getByText("Agents for every team", { exact: true }).isVisible();
      return { pass: h, detail: h ? "Present" : "Missing" };
    });

    await c.check("Tabs: Recommended, Your agents, Verified, Templates, All agents", async () => {
      const tabs = (await page.locator(agentsDialog).getByRole("tab").allInnerTexts()).map((t) => t.trim());
      const want = ["Recommended", "Your agents", "Verified", "Templates", "All agents"];
      return { pass: JSON.stringify(tabs) === JSON.stringify(want), detail: `Tabs: ${tabs.join(", ")}` };
    });

    await c.check("Search box", async () => {
      const search = await page.locator(`${agentsDialog} input, ${agentsDialog} [role="searchbox"], ${agentsDialog} [role="textbox"]`).first().isVisible();
      return { pass: search, detail: search ? "Present" : "Missing" };
    });

    await c.check("Create agent button next to the search box", async () => {
      const create = await page.locator(`${agentsDialog} button`, { hasText: /^Create agent$/ }).first().isVisible();
      return { pass: create, detail: create ? "Present" : "Missing" };
    });

    await c.check("Section 'Recommended agents' with agent cards", async () => {
      const heading = await page.locator(agentsDialog).getByText("Recommended agents", { exact: true }).isVisible();
      const cards = await page.locator(`${agentsDialog} [data-testid^="browse-agent--"][aria-label]`).count();
      return { pass: heading && cards > 0, detail: `Heading: ${heading ? "present" : "missing"}; ${cards} cards` };
    });

    await c.check("Agent menu: View agent profile, Chat with agent, Add to starred, Copy link, Duplicate agent", async () => {
      const items = (await menu(page).locator('[role="menuitem"], button, a').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const missing = ["View agent profile", "Chat with agent", "Add to starred", "Copy link", "Duplicate agent"].filter((t) => !items.includes(t));
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}` };
    });
  },
});
