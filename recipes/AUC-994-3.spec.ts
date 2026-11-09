// Lesson:  AUC-994 — Find your assets with AQL
//          https://community.atlassian.com/learning/lesson/find-your-assets-with-aql
// Image:   #3, section "Assets fields in Jira"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/050201081d0hmsgybc2q8l467e3o6407.png
// Recipe:  public.screenshot_recipes where asset_id = '050201081d0hmsgybc2q8l467e3o6407'
// Test data on the test site: ITS Incidents "My laptop is not turning on" (Completed) and "Keyboard is broken"
// (Work in progress), both with Employee = Assets object "Alana Grant"; the test account's All work columns
// set to Work, Status, Employee, Priority.

import { runRecipe } from "../lib/recipe";
import { openJqlSearch } from "../lib/jira";
import { anonymize, arrowTo, spotlightAreas } from "../lib/tweaks";

const JQL = 'Employee in aqlFunction("Name = \\"Alana Grant\\"")';

const searchBar = '[data-testid="jql-builder.common.ui.components.editor-spacing-components.before-jql-builder-container"] button';
const editor = '[data-testid="jql-editor-input"]';
const results = '[data-testid="native-issue-table.ui.scroll-container.scroll-container"]';
const footer = '[data-testid="native-issue-table.common.ui.components.footer.footer-container"]';

runRecipe({
  file: "AUC-994-3",
  assetId: "050201081d0hmsgybc2q8l467e3o6407",
  title: "AUC-994 #3 — JQL with aqlFunction for an Assets field",
  product: "jira",

  navigate: (page, s) => openJqlSearch(page, s, JQL),

  async tweak(page) {
    await anonymize(page);
    // Outline the search bar (AI to the end of the JQL box) and the results, as in the lesson
    await spotlightAreas(page, [
      [page.locator(searchBar).first(), page.locator(editor).locator("xpath=../..")],
      [page.locator(results), page.locator(footer)],
    ]);
    await arrowTo(page, page.locator(results), { from: "above", offsetY: 60 });
  },

  async checks(page, c) {
    await c.check("JQL view shows the aqlFunction query", async () => {
      const text = (await page.locator(editor).innerText()).trim();
      return { pass: text.includes("aqlFunction") && text.includes("Alana Grant"), detail: `"${text}"` };
    });

    await c.check("Search bar has AI, Basic and JQL", async () => {
      const missing = [];
      for (const name of ["AI", "Basic", "JQL"]) {
        const visible = await page.getByRole("button", { name, exact: true }).or(page.getByRole("radio", { name, exact: true })).first().isVisible();
        if (!visible) missing.push(name);
      }
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Results: 2 work items, both with Employee Alana Grant", async () => {
      const count = (await page.getByText(/^\d+ of \d+$/).first().innerText()).trim();
      const rows = await page.locator(`${results} tbody tr`).count();
      const alana = await page.locator(results).getByText("Alana Grant").count();
      const pass = count === "2 of 2" && alana === 2;
      return { pass, detail: `${count}, ${rows} rows, Alana Grant shown ${alana} times` };
    });

    await c.check("Test data: columns Work, Status, Employee, Priority", async () => {
      // Header cells also hold hidden sort and menu buttons; the column name is the first line
      const heads = (await page.locator(`${results} thead th`).allInnerTexts())
        .map((t) => t.split("\n")[0].trim())
        .filter((t) => t && t !== "Configure columns");
      const expected = ["Work", "Status", "Employee", "Priority"];
      const pass = JSON.stringify(heads) === JSON.stringify(expected);
      return { pass, detail: `Columns: ${heads.join(", ")}` };
    });

    await c.check("Test data: one work item Completed, one Work in progress", async () => {
      const done = await page.locator(results).getByText("Completed", { exact: true }).count();
      const wip = await page.locator(results).getByText("Work in progress", { exact: true }).count();
      return { pass: done === 1 && wip === 1, detail: `Completed: ${done}, Work in progress: ${wip}` };
    });
  },
});
