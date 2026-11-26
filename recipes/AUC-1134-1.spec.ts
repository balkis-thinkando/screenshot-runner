// Lesson:  AUC-1134 - Determine what displays on a Jira board using filters
//          https://community.atlassian.com/learning/lesson/filter-jira-board
// Image:   #1, section "Control what appears on your board" (PLAT board, All work tab in JQL view with the query
//          "project = PLAT ORDER BY created DESC"; Ask AI, the Basic/JQL switch and the query are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12AZ.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12AZ'
// UI change: spaces no longer have an All work tab (PLAT board's tabs and More menu were checked; the List tab has no
// JQL view). The recipe first checks the PLAT board's tabs, then opens the global All work page in the JQL view with
// the lesson's query and outlines Ask AI, the Basic/JQL switch and the query.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openJqlSearch } from "../lib/jira";
import { markers, spotlightAreas } from "../lib/tweaks";
import { jiraPeopleTweaks } from "../lib/b2-jira";
import { hideSidebarAd, openBoard, PLAT, tabLabels } from "../lib/b3-jboards";

const JQL = "project = PLAT ORDER BY created DESC";
const basic = (page: Page) => page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.basic"]');
const jqlToggle = (page: Page) => page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.advanced"]');
const ai = (page: Page) => page.getByRole("button", { name: /^(Ask )?AI$/ }).first();
const editor = (page: Page) => page.locator('[data-testid="jql-editor-input"]');

// What the PLAT board offered, read in navigate() before leaving it
let spaceTabs: string[] = [];
let moreItems: string[] = [];

runRecipe({
  file: "AUC-1134-1",
  assetId: "AT12AZ",
  title: "AUC-1134 #1 - Board query in the JQL view",
  product: "jira",

  async navigate(page, s) {
    // Two page loads (the board, then All work)
    test.setTimeout(240_000);
    await openBoard(page, s, PLAT);
    spaceTabs = await tabLabels(page);
    await page.locator('[data-testid="navigation-kit-ui-tab-list.ui.more-trigger.more-tab"]').click();
    await page.getByText("Components", { exact: true }).or(page.getByText("Releases", { exact: true })).first().waitFor({ timeout: 10_000 }).catch(() => {});
    // The More menu's items are links, not menu items: read the open popup's lines
    if (await page.getByText("All work", { exact: true }).first().isVisible().catch(() => false)) moreItems = ["All work"];
    else moreItems = (await page.locator('[data-testid="navigation-kit-ui-tab-list.ui.more-trigger.more-tab"]').getAttribute("aria-controls").then((id) => (id ? page.locator(`#${id}`).innerText() : "")).catch(() => "")).split("\n").map((t) => t.trim()).filter((t) => t && !t.includes("@") && !t.startsWith("More actions for"));
    await page.keyboard.press("Escape");
    await openJqlSearch(page, s, JQL);
    await page.locator("table tbody tr").nth(2).waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideSidebarAd(page);
    await jiraPeopleTweaks(page, s);
    await spotlightAreas(page, [[ai(page), basic(page), editor(page)]]);
    await markers(page, jqlToggle(page), "down", [60]);
  },

  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Space has an All work tab (lesson: PLAT board > All work)", async () => {
      const inTabs = spaceTabs.includes("All work");
      const inMore = moreItems.some((m) => /^All work/.test(m));
      return {
        pass: inTabs || inMore,
        detail: inTabs || inMore
          ? "Present"
          : `UI change: no All work tab in the space (tabs: ${spaceTabs.join(", ")}; More: ${moreItems.join(", ")}); the recipe uses the global All work page`,
      };
    });

    await c.check("Basic/JQL switch with JQL selected", async () => {
      const on = (await jqlToggle(page).getAttribute("aria-checked")) ?? (await jqlToggle(page).getAttribute("aria-pressed"));
      return { pass: on === "true", detail: `JQL selected: ${on}` };
    });

    await c.check("JQL editor shows 'project = PLAT ORDER BY created DESC'", async () => {
      const q = (await editor(page).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      return { pass: q.toLowerCase() === JQL.toLowerCase(), detail: `Query: ${q.slice(0, 80)}` };
    });

    await c.check("Ask AI button left of the switch", async () => {
      const v = await ai(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Toolbar: Clear filters, Group, list and detail views", async () => {
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["Clear filters", "Group"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Results table: Work, Assignee, Reporter, Priority", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
      const missing = ["Work", "Assignee", "Reporter", "Priority"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}${missing.length ? " (test data: the site's default columns differ)" : ""}` };
    });
  },
});
