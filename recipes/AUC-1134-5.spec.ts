// Lesson:  AUC-1134 - Determine what displays on a Jira board using filters
//          https://community.atlassian.com/learning/lesson/filter-jira-board
// Image:   #5, section "Create quick filters" (PLAT board settings > Quick filters; Create quick filter dialog filled
//          in with Name "Mobile", JQL "component= Mobile", Description "Filter for mobile related work items")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12B0.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12B0'
// Opens PLAT board settings, the filters page (now "Custom filters"), clicks Create custom filter and types the
// lesson's values. Create is never clicked, so nothing is saved.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { boardPath, hideSidebarAd, PLAT } from "../lib/b3-jboards";

const P = "software-board-settings-query-list-config-common";
const dialog = (page: Page) => page.locator(`[data-testid="${P}.ui.create-query-modal.modal"]`);
const field = (page: Page, name: "name" | "query" | "description") => page.locator(`[data-testid="${P}.common.ui.modal-form.${name}-field.field"]`);
const NAME = "Mobile";
const QUERY = "component= Mobile";
const DESCRIPTION = "Filter for mobile related work items";

runRecipe({
  file: "AUC-1134-5",
  assetId: "AT12B0",
  title: "AUC-1134 #5 - Create quick filter dialog",
  product: "jira",

  async navigate(page, s) {
    // Settings pages are slow to load
    test.setTimeout(240_000);
    await openSignedIn(page, s, boardPath(PLAT, "/settings/quickFilters?config=filter"));
    const create = page.getByRole("button", { name: /^Create (quick|custom) filter$/ });
    await create.waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await closeTours(page);
    await create.click();
    await dialog(page).waitFor({ timeout: 15_000 });
    await field(page, "name").locator("input").fill(NAME);
    await field(page, "query").locator('[data-testid="jql-editor-input"]').click();
    await page.keyboard.type(QUERY);
    await field(page, "description").locator("input, textarea").first().fill(DESCRIPTION);
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideSidebarAd(page);
    await jiraPeopleTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Board settings nav with 'Quick filters' selected", async () => {
      const nav = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const quick = /Quick filters/.test(nav);
      const custom = /Custom filters/.test(nav);
      return { pass: quick && nav.includes("Board settings"), detail: `${nav.includes("Board settings") ? "Board settings nav" : "No Board settings nav"}; ${quick ? "Quick filters" : custom ? "UI change: the item is now 'Custom filters'" : "no filters item"}` };
    });

    await c.check("Settings nav: Details, Working Days, Estimation, Timeline, Layout (Columns, Swimlanes, Card colors, Card layout)", async () => {
      const nav = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const missing = ["Details", "Working Days", "Estimation", "Timeline", "Layout", "Columns", "Swimlanes", "Card colors", "Card layout"].filter((t) => !nav.includes(t));
      return { pass: !missing.length, detail: missing.length ? `UI change, missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Dialog titled 'Create quick filter'", async () => {
      const t = (await dialog(page).locator(`[data-testid="${P}.ui.create-query-modal.modal--title-text"]`).innerText().catch(() => "")).trim();
      return { pass: t === "Create quick filter", detail: `Title: "${t}"${t === "Create custom filter" ? " (UI change: renamed)" : ""}` };
    });

    await c.check("Fields filled in: Name, JQL query, Description", async () => {
      const name = await field(page, "name").locator("input").inputValue().catch(() => "");
      const query = (await field(page, "query").locator('[data-testid="jql-editor-input"]').innerText().catch(() => "")).trim();
      const desc = await field(page, "description").locator("input, textarea").first().inputValue().catch(() => "");
      const labels = await dialog(page).innerText();
      const allLabels = ["Name", "JQL query", "Description"].every((l) => labels.includes(l));
      return { pass: allLabels && name === NAME && query === QUERY && desc === DESCRIPTION, detail: `Labels: ${allLabels}; name: "${name}"; query: "${query}"; description: "${desc}"` };
    });

    await c.check("Cancel and Create buttons", async () => {
      const cancel = await page.locator(`[data-testid="${P}.common.ui.modal-form.cancel-button"]`).isVisible();
      const create = await page.locator(`[data-testid="${P}.common.ui.modal-form.submit-button"]`).isVisible();
      return { pass: cancel && create, detail: `Cancel: ${cancel}; Create: ${create}` };
    });

    await c.check("Existing filters behind the dialog: Assigned to me, Recently Updated", async () => {
      const missing: string[] = [];
      for (const t of ["Assigned to me", "Recently Updated"]) if (!(await page.getByText(t, { exact: true }).first().isVisible().catch(() => false))) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });
  },
});
