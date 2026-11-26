// Lesson:  AUC-940 - Create knowledge base articles
//          https://community.atlassian.com/learning/lesson/create-jira-service-management-knowledge-base-articles
// Image:   #3, section "4. Use categories and labels to organize articles" (PIR knowledge base article in Jira (PIR - workday - web 404 error): Categories and Labels outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/gdd21o44yp080447jq4p06i5o80gt81v.png
// Recipe:  public.screenshot_recipes where asset_id = 'gdd21o44yp080447jq4p06i5o80gt81v'
// Needs test data: reaches the IT Support (ITS) Knowledge Base page (closest real screen).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

// Test data: the test account cannot see the Confluence space behind the ITS knowledge base (Nov 2026: "You don't have
// access to this space"), and no knowledge base it can open has articles, so the article view cannot be reached.

runRecipe({
  file: "AUC-940-3",
  assetId: "gdd21o44yp080447jq4p06i5o80gt81v",
  title: "AUC-940 #3 - Post-incident review article categories and labels",
  product: "jira",

  navigate: (page, s) => openAndWait(page, s, "/jira/servicedesk/projects/ITS/knowledge/articles", (p) => p.getByRole("heading", { name: "Knowledge Base" })),
  tweak: (page, s) => jsmTweaks(page, s),

  async checks(page, c) {
    await checkHeading(c, "Knowledge Base page of the space (Articles, Suggested topics)", page, "Knowledge Base");
    await c.check("Post-incident review article view with Categories and Labels", async () => {
      const blocked = await page.getByText(/don't have access to this space/i).first().isVisible().catch(() => false);
      return { pass: false, detail: blocked ? "Needs test data: the test account has no access to the ITS knowledge base space, so no article can be opened" : "Needs test data: no knowledge base article with categories and labels to open" };
    });
    await checkTexts(c, "Article side panel: Share this article, Space, Categories, Labels", page, ["Share this article", "Categories", "Labels"], mainArea(page), "Needs test data (article view not reachable). ");
  },
});
