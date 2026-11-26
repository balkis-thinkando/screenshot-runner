// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #2, section "Configure work linking" (Jira admin settings > Work items > Work item linking; the sidebar
//          item and the page content are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/gt41d8hkmv1b5584l8sa2g38sht34ceg
// Recipe:  public.screenshot_recipes where asset_id = 'gt41d8hkmv1b5584l8sa2g38sht34ceg'
// Opens Settings > Work items > Work item linking. Read only: Deactivate, Edit, Delete and Add are not clicked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, checkTexts, heading, jadminTweaks, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

const LESSON_TYPES = ["Action item", "Blocks", "Cloners", "Deployments", "Developer Escalations", "Duplicate", "Escalate"];

const linkTable = (page: import("@playwright/test").Page) => page.locator("table").filter({ hasText: "Outward Description" }).last();

runRecipe({
  file: "AUC-612-2",
  assetId: "gt41d8hkmv1b5584l8sa2g38sht34ceg",
  title: "AUC-612 #2 - Work item linking",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/ViewLinkTypes!default.jspa", page.getByText(/Work item linking is currently/).first(), "Work item linking");
    await scrollSidebarTo(page, "Work item linking");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [sidebarLink(page, "Work item linking"), [heading(page, "Work items"), page.getByText("Search Jira admin").first(), linkTable(page)]]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "Work items");
    await checkSidebar(c, page, "Sidebar: Work item features > Time tracking, Work item linking (selected)", ["Work item features", "Time tracking", "Work item linking", "Statuses", "Resolutions", "Work item security schemes"], "Work item linking");

    await c.check("Status line 'Work item linking is currently ON.' with Deactivate button", async () => {
      const on = await page.getByText(/Work item linking is currently\s*ON/).first().isVisible().catch(() => false);
      const btn = await page.getByRole("button", { name: "Deactivate" }).or(page.locator('input[value="Deactivate"]')).first().isVisible().catch(() => false);
      return { pass: on && btn, detail: `ON: ${on}; Deactivate: ${btn}` };
    });

    await checkTexts(c, page, "Note: Link Work items permission needed", ["Link Work items permission"]);

    await c.check("Columns: Name, Outward Description, Inward Description, Actions", async () => {
      const cols = (await linkTable(page).locator("th").allInnerTexts()).map((t) => t.trim());
      const missing = ["Name", "Outward Description", "Inward Description", "Actions"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Link types of the lesson listed with Edit and Delete", async () => {
      const names = (await linkTable(page).locator("tbody tr td:first-child").allInnerTexts()).map((t) => t.trim());
      const missing = LESSON_TYPES.filter((t) => !names.includes(t));
      const edit = await linkTable(page).getByText("Edit", { exact: true }).count();
      return { pass: !missing.length && edit > 0, detail: `${names.length} link types${missing.length ? `; missing: ${missing.join(", ")}` : ""}; Edit links: ${edit}` };
    });
  },
});
