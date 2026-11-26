// Lesson:  AUC-1701 - Use JQL to filter search results
//          https://community.atlassian.com/learning/lesson/use-jira-jql-search
// Image:   #5, section "Learn the language of JQL queries" (JQL view, "st" typed in the JQL box; the box and its
//          field suggestions are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/cx5gohab5g31qu4k4bm5j1t0mi5lh407.png
// Recipe:  public.screenshot_recipes where asset_id = 'cx5gohab5g31qu4k4bm5j1t0mi5lh407'
// All work in the JQL view; the query is cleared and "st" typed, nothing is run or saved. The results behind the
// suggestions and the recent sidebar items change over time, so they are masked.

import { runRecipe } from "../lib/recipe";
import { fakeNames, spotlightAreas } from "../lib/tweaks";
import { jiraPeopleTweaks } from "../lib/b2-jira";
import { jqlAutocomplete, jqlEditor, openJql, sidebarRecent } from "../lib/b3-jsearch";

const JQL = "created >= -30d order by created DESC";
const options = (page: import("@playwright/test").Page) => jqlAutocomplete(page).locator('[data-testid="jql-editor-autocomplete-option"]');

runRecipe({
  file: "AUC-1701-5",
  assetId: "cx5gohab5g31qu4k4bm5j1t0mi5lh407",
  title: "AUC-1701 #5 - JQL field suggestions",
  product: "jira",

  async navigate(page, s) {
    await openJql(page, s, JQL);
    await page.locator("table tbody tr").first().waitFor({ timeout: 60_000 });
  },

  async tweak(page, s) {
    // The people tweaks rewrite text nodes, which makes the JQL editor re-render and lose its caret, so "st" is
    // typed after them
    await jiraPeopleTweaks(page, s);
    await fakeNames(page, "Employee");
    await jqlEditor(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("st", { delay: 100 });
    // The list narrows to the fields starting with "st"
    await options(page).first().filter({ hasText: /^st/i }).waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    await spotlightAreas(page, [[jqlEditor(page), jqlAutocomplete(page)]]);
  },

  mask: (page) => [page.locator("table tbody"), page.getByText(/^\d+ of \d+\+?$/), ...sidebarRecent(page)],

  async checks(page, c) {
    await c.check("JQL view with 'st' typed in the JQL box", async () => {
      const t = (await jqlEditor(page).innerText()).trim();
      return { pass: t === "st", detail: `JQL box: "${t.slice(0, 40)}"` };
    });

    await c.check("Suggestions start with Stage (Dropdown), Standard Change, Start date (Date), status, statusCategory", async () => {
      const items = (await options(page).allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const lesson = ["Stage", "Standard Change - cf[10099]", "Start date", "status", "statusCategory", "statusCategoryChangedDate"];
      const missing = lesson.filter((l) => !items.includes(l));
      return { pass: !missing.length, detail: `Suggestions: ${items.slice(0, 8).join(", ")}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Field types shown under Stage (Dropdown) and Start date (Date)", async () => {
      const text = await jqlAutocomplete(page).innerText();
      const ok = /Stage\s*\n?\s*Dropdown/.test(text) && /Start date\s*\n?\s*Date/.test(text);
      return { pass: ok, detail: ok ? "Present" : "Field types missing" };
    });

    await c.check("Hint under the JQL box: Enter to search, Shift+Enter to add a new line", async () => {
      const text = await page.locator("#unsafe-design-system-page-layout-root").innerText();
      const ok = /Enter\s+to search/.test(text) && /Shift\+Enter\s+to add a new line/.test(text);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Toolbar: Basic/JQL with JQL selected, Clear filters, Save filter", async () => {
      const on = await page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.advanced"]').getAttribute("aria-checked").catch(() => null);
      const text = await page.locator("#unsafe-design-system-page-layout-root").innerText();
      const missing = ["Clear filters", "Save filter"].filter((t) => !text.includes(t));
      return { pass: on === "true" && !missing.length, detail: `JQL selected: ${on}; missing: ${missing.join(", ") || "none"}` };
    });
  },
});
