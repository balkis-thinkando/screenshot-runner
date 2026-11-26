// Lesson:  AUC-1691 - Use a scrum board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-use-jira-scrum-board
// Image:   #4, section "Explore the backlog" (Backlog tab outlined; the sprint's work items above and the Backlog
//          section with its work items, Create sprint and Create outlined below)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ck4qs18qn57rl60m34kkq5k5h35dsem6.png
// Recipe:  public.screenshot_recipes where asset_id = 'ck4qs18qn57rl60m34kkq5k5h35dsem6'
// Opens the backlog of CC Web Development (M0002 - CodeCrafters), a scrum board with an active sprint and work items
// in the backlog (TH board's backlog is empty), scrolls down to the Backlog section and outlines it and the Backlog tab.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardTweaks, openBoard, recentSpaces, SCRUM_BACKLOG, selectedTab, tab } from "../lib/b3-jboards";

const backlogSection = (page: Page) => page.locator('[data-testid="software-backlog.card-list.container.BACKLOG"]');

runRecipe({
  file: "AUC-1691-4",
  assetId: "ck4qs18qn57rl60m34kkq5k5h35dsem6",
  title: "AUC-1691 #4 - Backlog section",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, SCRUM_BACKLOG, "/backlog");
    await backlogSection(page).waitFor({ state: "attached", timeout: 60_000 });
    // As in the lesson: the end of the sprint list at the top, the Backlog section below it
    await backlogSection(page).evaluate((el) => {
      let sc: HTMLElement | null = el.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) sc.scrollTop += el.getBoundingClientRect().top - 300;
    });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    await spotlightAreas(page, [tab(page, "Backlog"), backlogSection(page)]);
  },

  mask: (page) => [recentSpaces(page), page.locator('[data-testid="software-backlog.backlog-content.scrollable"]')],

  async checks(page, c) {
    await c.check("'Backlog' tab selected", async () => {
      const sel = await selectedTab(page);
      return { pass: sel === "Backlog", detail: `Selected tab: "${sel}"` };
    });

    await c.check("Toolbar: Search backlog, people, Version, Epic, Quick filters", async () => {
      const text = await page.locator('[data-testid="software-backlog.page-header"]').innerText().catch(() => "");
      const missing = ["Version", "Epic"].filter((t) => !text.includes(t));
      const quick = text.includes("Quick filters");
      const custom = text.includes("Custom filters");
      return {
        pass: !missing.length && quick,
        detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}${quick ? "Quick filters present" : custom ? "UI change: 'Quick filters' is now 'Custom filters'" : "no Quick/Custom filters"}`,
      };
    });

    await c.check("Sprint list with work items above the backlog", async () => {
      const sprints = await page.locator('[data-testid^="software-backlog.card-list.container."]:not([data-testid$=".BACKLOG"])').count();
      return { pass: sprints > 0, detail: `${sprints} sprint lists` };
    });

    await c.check("Backlog section: 'Backlog (N work items)', work items, Create sprint, + Create", async () => {
      const sec = backlogSection(page);
      const text = await sec.innerText().catch(() => "");
      const header = /Backlog/.test(text) && /\(\d+ work items?\)/.test(text);
      const items = await sec.locator('[data-testid^="software-backlog.card-list.card.content-container."]').count();
      const createSprint = await sec.locator('[data-testid="software-backlog.card-list.card-list-header.create-sprint-button"]').isVisible().catch(() => false);
      const create = /\bCreate\b/.test(text.replace("Create sprint", ""));
      return {
        pass: header && items > 0 && createSprint && create,
        detail: `Header with count: ${header}; ${items} work items (lesson: 4); Create sprint: ${createSprint}; Create: ${create}`,
      };
    });
  },
});
