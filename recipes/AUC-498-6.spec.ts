// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #6, "Your agents" tab of the agents dialog, menu of an agent you own (menu outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ke2a12017lf6a37y123471cv0w71a330.png
// Recipe:  public.screenshot_recipes where asset_id = 'ke2a12017lf6a37y123471cv0w71a330'
// Test data: the "DACI Document Assistant" agent owned by the test account (lib/studio.ts). The menu is only
// opened; nothing in it is clicked. The lesson's agent is "Duplicate Detector", owned by Emma Rose.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { agentsDialog, fakeGreeting, keepAgentIcons, openAgentsDialog, openRovoChat } from "../lib/rovo";
import { DACI_AGENT } from "../lib/studio";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const OWNER = FAKE_PEOPLE[4]; // Emma Rose, as in the lesson
const owned = (page: Page) => page.locator(`${agentsDialog} [data-testid="browse-agent--owned"]`);
const card = (page: Page) => owned(page).locator('[data-testid^="browse-agent--owned--card-"]').filter({ hasText: DACI_AGENT.name }).first();
const menu = (page: Page) => page.locator('[role="menu"]').last();

runRecipe({
  file: "AUC-498-6",
  assetId: "ke2a12017lf6a37y123471cv0w71a330",
  title: "AUC-498 #6 - Your agents, owner menu",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/for-you");
    await openRovoChat(page);
    await openAgentsDialog(page);
    await page.locator(agentsDialog).getByRole("tab", { name: "Your agents" }).click();
    await page.locator(agentsDialog).getByText("Owned by you").waitFor({ timeout: 30_000 });
    await card(page).waitFor({ timeout: 30_000 });
    await card(page).getByRole("button", { name: `More actions for ${DACI_AGENT.name}` }).click();
    await menu(page).getByText("Delete agent").waitFor({ timeout: 15_000 });
    // Opening the menu scrolls the list; show it from the top, as in the lesson
    await page.locator(`${agentsDialog} [data-testid="modal-dialog--scrollable"]`).evaluate((el) => (el.scrollTop = 0)).catch(() => {});
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeGreeting(page, OWNER.split(" ")[0]);
    await keepAgentIcons(page);
    await fakeSignedInUser(page, OWNER);
    await fakeProfileNames(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await spotlight(page, menu(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Tabs: Recommended, Your agents (selected), Verified, Templates, All agents", async () => {
      const tabs = (await page.locator(agentsDialog).getByRole("tab").allInnerTexts()).map((t) => t.trim());
      const selected = (await page.locator(agentsDialog).getByRole("tab", { selected: true }).innerText()).trim();
      const want = ["Recommended", "Your agents", "Verified", "Templates", "All agents"];
      return { pass: JSON.stringify(tabs) === JSON.stringify(want) && selected === "Your agents", detail: `Tabs: ${tabs.join(", ")}; selected: ${selected}` };
    });

    await c.check("Section 'Owned by you' with the agent card (name, owner, description)", async () => {
      const heading = await page.locator(agentsDialog).getByText("Owned by you", { exact: true }).isVisible();
      const owner = (await card(page).innerText()).includes(OWNER);
      return { pass: heading && owner, detail: `Heading: ${heading}; owner on card: ${owner}` };
    });

    await c.check("Owner menu: View agent profile, Chat with agent, starred, Copy link, Duplicate, Verify, Edit, Delete agent", async () => {
      const items = (await menu(page).locator('[role="menuitem"], button, a').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const missing = ["View agent profile", "Chat with agent", "Copy link", "Duplicate agent", "Verify agent", "Edit agent", "Delete agent"].filter((t) => !items.includes(t));
      const starred = items.some((t) => /starred/i.test(t));
      return { pass: !missing.length && starred, detail: `Items: ${items.join(", ")}` };
    });

    await c.check("Section 'Starred' below (now 'Starred by you')", async () => {
      const starred = await page.locator(agentsDialog).getByText(/^Starred( by you)?$/).first().isVisible();
      return { pass: starred, detail: starred ? "Present" : "Missing" };
    });
  },
});
