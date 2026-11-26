// Lesson:  AUC-1137 - Use backlogs for planning
//          https://community.atlassian.com/learning/lesson/jira-backlog
// Image:   #1, section "Configure and use backlogs in Jira" (kanban board settings > Layout > Columns, "Map statuses to
//          columns" with an empty Kanban backlog column outlined: "Drag and drop a status here to enable the Kanban
//          backlog.")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/t7q5uy38441v50b6j3365361yapop232.png
// Recipe:  public.screenshot_recipes where asset_id = 't7q5uy38441v50b6j3365361yapop232'
// Opens the Columns settings of MP board (Mobile Program), a kanban board without a Kanban backlog, scrolls to the
// status mapping and outlines the Kanban backlog column. Nothing is dragged or changed.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { spotlight } from "../lib/tweaks";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { boardPath, hideSidebarAd, KANBAN } from "../lib/b3-jboards";

/** The Kanban backlog column: the innermost box with both its title and its drop hint. */
const kanbanBacklog = (page: Page) =>
  page.locator("div").filter({ hasText: /^Kanban backlog/ }).filter({ hasText: /Drag and drop a status here to enable the Kanban backlog|dedicated space/ }).last();
const epicHeading = (page: Page) => page.getByText("Epic work items", { exact: true }).first();

runRecipe({
  file: "AUC-1137-1",
  assetId: "t7q5uy38441v50b6j3365361yapop232",
  title: "AUC-1137 #1 - Kanban backlog column",
  product: "jira",

  async navigate(page, s) {
    // Settings pages are slow to load
    test.setTimeout(240_000);
    await openSignedIn(page, s, boardPath(KANBAN, "/settings/columns"));
    await page.getByText("Map statuses to columns").first().waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await closeTours(page);
    // As in the lesson: Epic work items near the top, the status columns below
    await epicHeading(page).evaluate((el) => {
      let sc: HTMLElement | null = el.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const target = sc ?? document.scrollingElement!;
      target.scrollTop += el.getBoundingClientRect().top - 120;
    });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideSidebarAd(page);
    await jiraPeopleTweaks(page, s);
    // The column box around the title (the title block's container column)
    await kanbanBacklog(page).evaluate((el) => {
      let box = el as HTMLElement;
      while (box.parentElement && box.parentElement.getBoundingClientRect().width < 260 && box.parentElement.innerText.length < 300) box = box.parentElement;
      box.setAttribute("data-jb-kanban-backlog", "");
    });
    await spotlight(page, page.locator("[data-jb-kanban-backlog]"), { markers: false });
  },

  async checks(page, c) {
    await c.check("Board settings nav: Layout > Columns selected", async () => {
      const nav = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const cur = (await page.locator('[data-testid="page-layout.sidebar"] [aria-current="page"]').first().innerText().catch(() => "")).trim();
      const layout = nav.split("\n").map((l) => l.trim()).includes("Layout");
      return { pass: cur === "Columns" && layout, detail: `Selected: "${cur}"; Layout group: ${layout}${layout ? "" : " (UI change: Columns is now a top-level item)"}` };
    });

    await c.check("'Epic work items' section: Display as cards on the board / in Epic panel on the backlog", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').innerText().catch(() => "");
      const ok = text.includes("Epic work items") && text.includes("Display as cards on the board") && text.includes("Display in Epic panel on the backlog");
      return { pass: ok, detail: ok ? "Present" : "Missing or reworded" };
    });

    await c.check("'Map statuses to columns' with Unmapped statuses, Kanban backlog and the board columns", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').innerText().catch(() => "");
      const missing = ["Map statuses to columns", "Unmapped statuses", "Kanban backlog"].filter((t) => !text.includes(t));
      const cols = ["BACKLOG", "IN PROGRESS"].filter((t) => !text.toUpperCase().includes(t));
      return { pass: !missing.length && !cols.length, detail: `${[...missing, ...cols].length ? `Missing: ${[...missing, ...cols].join(", ")}` : "All present"}` };
    });

    await c.check("Kanban backlog column empty: 'Drag and drop a status here to enable the Kanban backlog.'", async () => {
      const text = (await page.locator("[data-jb-kanban-backlog]").innerText().catch(() => "")).replace(/\s+/g, " ");
      const desc = text.includes("A dedicated space away from the board to plan your team's work.");
      const hint = text.includes("Drag and drop a status here to enable the Kanban backlog");
      return { pass: desc && hint, detail: `Description: ${desc}; drop hint: ${hint}${hint ? "" : " (test data: the Kanban backlog has a status)"}` };
    });

    await c.check("Column constraints (Min / Max) on the board columns", async () => {
      const n = await page.getByText("Min", { exact: true }).count();
      return { pass: n > 0, detail: `${n} Min fields` };
    });
  },
});
