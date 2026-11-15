// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #3, section "Create conversation starters for your Agent" (conversation starters outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2iu7bd2p8gr40g8fprqh41mp8jgc2112.png
// Recipe:  public.screenshot_recipes where asset_id = '2iu7bd2p8gr40g8fprqh41mp8jgc2112'
// A new chat with the Work Item Planner agent on the Employee Onboarding board. Nothing is sent to the agent.

import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { agentChecks, boardReady, chatWithAgent, fakeGreeting, keepAgentIcons, openRovoChat, starters } from "../lib/rovo";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

runRecipe({
  file: "AUC-498-3",
  assetId: "2iu7bd2p8gr40g8fprqh41mp8jgc2112",
  title: "AUC-498 #3 - Agent conversation starters",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/core/projects/EO/board");
    await boardReady(page);
    await openRovoChat(page);
    await chatWithAgent(page, "Work Item Planner");
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no tooltip left on the page
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeGreeting(page, FAKE_PEOPLE[5].split(" ")[0]);
    await keepAgentIcons(page);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    // One outlined area around the starters, as in the lesson
    await spotlightAreas(page, [[starters(page).first(), starters(page).last()]]);
  },

  mask: (page) => [page.locator('[data-testid*="board"] [data-testid*="card"], [data-component-selector*="card"]')],

  checks: agentChecks,
});
