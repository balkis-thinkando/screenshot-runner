// Lesson:  AUC-385 - Use basic search to find information in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-basic-search
// Image:   #5, section "Switch to advanced search" (crop of the All work toolbar; the toolbar is outlined and an
//          arrow points at the Basic/JQL switch)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT11VC.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT11VC'
// All work with an empty query in the Basic view; the capture is the top of the window, as in the lesson crop.
// Nothing is saved and JQL is not selected.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlightAreas } from "../lib/tweaks";
import { jiraPeopleTweaks, openAllWork } from "../lib/b2-jira";

const basic = (page: Page) => page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.basic"]');
const jql = (page: Page) => page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.advanced"]');
const ai = (page: Page) => page.getByRole("button", { name: /^(Ask )?AI$/ }).first();
const saveFilter = (page: Page) => page.getByRole("button", { name: "Save filter" }).or(page.getByRole("link", { name: "Save filter" })).first();
const moreFilters = (page: Page) => page.locator("button:visible", { hasText: "More filters" }).first();

runRecipe({
  file: "AUC-385-5",
  assetId: "AT11VC",
  title: "AUC-385 #5 - Basic/JQL switch on All work",
  product: "jira",

  async navigate(page, s) {
    await openAllWork(page, s, "Basic");
    await page.locator("table tbody tr").nth(2).waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    // The whole toolbar, from Ask AI to Save filter
    const parts = [ai(page), basic(page), moreFilters(page), saveFilter(page)];
    const visible = [];
    for (const p of parts) if (await p.isVisible().catch(() => false)) visible.push(p);
    await spotlightAreas(page, [visible]);
    await markers(page, jql(page), "down", [60]);
  },

  // The lesson image is a crop of the top of the window
  clip: { x: 0, y: 0, width: 1280, height: 420 },

  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Basic/JQL switch with Basic selected", async () => {
      const b = await basic(page).isVisible();
      const j = await jql(page).isVisible();
      const on = (await basic(page).getAttribute("aria-checked")) ?? (await basic(page).getAttribute("aria-pressed"));
      return { pass: b && j && on === "true", detail: `Basic: ${b}; JQL: ${j}; Basic selected: ${on}` };
    });

    await c.check("Ask AI button left of the switch", async () => {
      const v = await ai(page).isVisible().catch(() => false);
      const label = v ? (await ai(page).innerText()).trim() : "";
      return { pass: v, detail: v ? `Present ("${label}")` : "Missing" };
    });

    await c.check("Basic filters: Search work items, Space, Assignee, Type, Status, More filters, Save filter", async () => {
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["Space", "Assignee", "Type", "Status", "More filters", "Save filter"].filter((t) => !text.includes(t));
      const search = await page.getByPlaceholder(/Search work/).first().isVisible().catch(() => false);
      return { pass: !missing.length && search, detail: `Missing: ${missing.join(", ") || "none"}; search box: ${search}` };
    });

    await c.check("Page 'All work' with Apps, Share, Export", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const missing: string[] = [];
      for (const t of ["Apps", "Share", "Export"])
        if (!(await page.getByRole("button", { name: new RegExp(`^${t}`) }).first().isVisible().catch(() => false))) missing.push(t);
      return { pass: h1 === "All work" && !missing.length, detail: `"${h1}"${missing.length ? `; missing: ${missing.join(", ")} (UI change: Export is no longer a header button)` : ""}` };
    });
  },
});
