// Lesson:  AUC-497 - Work with Rovo Agents
//          https://community.atlassian.com/learning/lesson/work-with-rovo-agents
// Image:   #1, section "Find existing Agents" (View all agents outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/tn38kw685w34x4j01d15g2t65q661853.png
// Recipe:  public.screenshot_recipes where asset_id = 'tn38kw685w34x4j01d15g2t65q661853'

import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { chatPanel, fakeGreeting, keepAgentIcons, openRovoChat, openRovoMenu } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const viewAll = (page: import("@playwright/test").Page) => page.getByRole("link", { name: "View all agents" });

runRecipe({
  file: "AUC-497-1",
  assetId: "tn38kw685w34x4j01d15g2t65q661853",
  title: "AUC-497 #1 - Rovo Chat menu, View all agents",
  product: "jira",

  async navigate(page, s) {
    // Jira home (For you), then Ask Rovo and the chat menu
    await openSignedIn(page, s, "/jira/for-you");
    await page.locator("h2", { hasText: /Recommended spaces|For you/ }).first().waitFor({ timeout: 60_000 });
    await openRovoChat(page);
    await openRovoMenu(page);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no tooltip left on the page
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeGreeting(page, FAKE_PEOPLE[5].split(" ")[0]);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await spotlight(page, viewAll(page), { markers: false });
  },

  // Spaces and work items on the home page, recent chats and the agents listed in the menu are account data
  mask: (page) => [page.locator("main"), page.locator(chatPanel).getByRole("link").filter({ hasNotText: /View all/ })],

  async checks(page, c) {
    await c.check("Ask Rovo button in the top bar", async () => {
      const ask = await page.getByRole("button", { name: "Ask Rovo", exact: true }).isVisible();
      return { pass: ask, detail: ask ? "Present" : "Missing" };
    });

    await c.check("Chat menu: New chat, Agents, View all agents, Chats, View all conversations", async () => {
      const panel = page.locator(chatPanel);
      const missing = [];
      for (const t of ["New chat", "Agents", "View all agents", "Chats", "View all conversations"]) {
        if (!(await panel.getByText(t, { exact: true }).first().isVisible())) missing.push(t);
      }
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Agents section lists agents above View all agents", async () => {
      const agents = await page.locator(chatPanel).getByRole("link").filter({ hasNotText: /View all/ }).count();
      return { pass: agents > 0, detail: `${agents} agents listed` };
    });

    await c.check("Rovo spaces section (Recommended Rovo spaces, View all Rovo spaces)", async () => {
      const shown = await page.locator(chatPanel).getByText(/Rovo spaces/).first().isVisible();
      return { pass: shown, detail: shown ? "Present" : "Not in the menu" };
    });
  },
});
