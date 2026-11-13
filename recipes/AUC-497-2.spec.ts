// Lesson:  AUC-497 - Work with Rovo Agents
//          https://community.atlassian.com/learning/lesson/work-with-rovo-agents
// Image:   #2, section "Where to work with Agents" (chat panel outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/i87uq78fxiu1f5ktqp35x4s073r76b2f.png
// Recipe:  public.screenshot_recipes where asset_id = 'i87uq78fxiu1f5ktqp35x4s073r76b2f'
// A new chat with the Work Item Planner agent, opened from View all agents on the Employee Onboarding board.
// Nothing is sent to the agent.

import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { agentChecks, boardReady, chatPanel, chatWithAgent, fakeGreeting, keepAgentIcons, openRovoChat } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

runRecipe({
  file: "AUC-497-2",
  assetId: "i87uq78fxiu1f5ktqp35x4s073r76b2f",
  title: "AUC-497 #2 - Chat with an agent on a board",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/core/projects/EO/board");
    await boardReady(page);
    await openRovoChat(page);
    await chatWithAgent(page, "Work Item Planner");
  },

  async tweak(page, s) {
    await page.mouse.move(640, 790);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeGreeting(page, FAKE_PEOPLE[5].split(" ")[0]);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await spotlight(page, page.locator(chatPanel), { markers: false });
  },

  // Board cards are site data
  mask: (page) => [page.locator('[data-testid*="board"] [data-testid*="card"], [data-component-selector*="card"]')],

  checks: agentChecks,
});
