// Lesson:  AUC-703 - Build simple automation flows
//          https://community.atlassian.com/learning/lesson/build-simple-automation-rules
// Image:   #3, section "5. Test the automation flow" (Employee Onboarding space automation, Audit log tab; the tab and
//          the list of flow executions are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/3o2fv3fv0u15smf6571x670260gx4s41.png
// Recipe:  public.screenshot_recipes where asset_id = '3o2fv3fv0u15smf6571x670260gx4s41'
// Opens Employee Onboarding > Space settings > Automation > Audit log (the lesson's space). Nothing is run.
// Test data: the lesson lists several flow executions; Employee Onboarding has had none in the last 30 days
// (Nov 2026), so the list shows "No flow executions found" until a flow runs there.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { automationTab, basicTweaks, openPage } from "../lib/b3-jreports";

const LIST = '[data-testid="audit-log-list"]';

runRecipe({
  file: "AUC-703-3",
  assetId: "3o2fv3fv0u15smf6571x670260gx4s41",
  title: "AUC-703 #3 - Space automation audit log",
  product: "jira",

  async navigate(page, s) {
    await openPage(page, s, "/jira/core/projects/EO/settings/automate#/tab/audit-log", (p) => p.locator('[data-testid="audit-log"]'), "Employee Onboarding automation");
    await page.locator('[data-testid="audit-table--table"], [data-testid^="audit-table"]').first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await spotlightAreas(page, [automationTab(page, "audit-log"), page.locator(LIST)]);
  },

  // Executions, dates and IDs change on every run
  mask: (page) => [page.locator(LIST)],

  async checks(page, c) {
    await c.check("Breadcrumb Spaces / Employee Onboarding / Space settings / Automation and title 'Automation'", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const missing = ["Spaces", "Employee Onboarding", "Space settings", "Automation"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Header buttons: Global administration, Create with Rovo, Create rule", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const global = text.includes("Global administration");
      const rovo = text.includes("Create with Rovo");
      const create = (await page.locator('[data-testid="create-rule-drop-down"]').innerText().catch(() => "")).trim();
      return { pass: global && rovo && create === "Create rule", detail: `${global && rovo && create === "Create rule" ? "" : "UI change: "}Global administration: ${global}; Create with Rovo: ${rovo}; create button: "${create}" (lesson: Create rule)` };
    });

    await c.check("Tabs Rules, Audit log (selected), Templates, Usage", async () => {
      const tabs = (await Promise.all((["rules", "audit-log", "rule-library", "usage"] as const).map((t) => automationTab(page, t).innerText().catch(() => "")))).map((t) => t.trim());
      const ok = tabs.join(",") === "Rules,Audit log,Templates,Usage";
      return { pass: ok, detail: `${ok ? "" : "UI change: "}Tabs: ${tabs.join(", ")}` };
    });

    await c.check("Filters: Search rules, Date & time, Audit log ID, Actions, Triggers, Advanced, Reset filters", async () => {
      const search = await page.locator('[data-testid="audit-log-filter-name-search-select-select--control"]').isVisible();
      const date = await page.locator('[data-testid="date-time-picker-target"]').isVisible();
      const id = await page.locator('[data-testid="audit-log-id-filter-button"]').isVisible();
      const comps = await page.locator('[data-testid="component-selector-target"]').count();
      const reset = await page.locator('[data-testid="reset-button"]').isVisible();
      const advanced = await page.getByRole("button", { name: /Advanced/ }).first().isVisible().catch(() => false);
      return {
        pass: search && date && id && comps >= 2 && reset && advanced,
        detail: `${advanced ? "" : "UI change (no Advanced filter): "}Search: ${search}; date: ${date}; ID: ${id}; Actions/Triggers: ${comps}; Advanced: ${advanced}; Reset: ${reset}`,
      };
    });

    await c.check("Columns: Date & time, Audit log ID, Rule, Status, Duration, Operations", async () => {
      const cols = (await page.locator('[data-testid="audit-table--head--cell"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const missing = ["Date & time", "Audit log ID", "Rule", "Status", "Duration"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `${missing.length ? "UI change: " : ""}Columns: ${cols.join(", ")}` };
    });

    await c.check("Flow executions listed (lesson: six, with Success / No actions performed / Some errors)", async () => {
      const empty = await page.getByText(/No (flow|rule) executions found/).first().isVisible().catch(() => false);
      const rows = await page.locator('[data-testid="audit-table--table"] tbody tr').count();
      return { pass: !empty && rows > 0, detail: empty ? "Test data: no flow executions in Employee Onboarding in the last 30 days" : `Rows: ${rows}` };
    });
  },
});
