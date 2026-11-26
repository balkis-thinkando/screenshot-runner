// Lesson:  AUC-1134 - Determine what displays on a Jira board using filters
//          https://community.atlassian.com/learning/lesson/filter-jira-board
// Image:   #7, section "Create custom filters" (team-managed space settings > Board > Custom filters; the filter form
//          filled in with Name "Low priority" and Filter query "priority = Lowest")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT11W0.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT11W0'
// Opens the space settings of M0080 - SyncUp Platform (SYNC), a team-managed software space, at Custom filters, and
// types the lesson's name and query into the new filter form. Create is never clicked, so nothing is saved.
// The space has no custom filters yet, so the form shows Create instead of the lesson's Update (test data).

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { hideSidebarAd } from "../lib/b3-jboards";

const NAME = "Low priority";
const QUERY = "priority = Lowest";
const nameBox = (page: Page) => page.getByPlaceholder("Name your filter");
const descBox = (page: Page) => page.getByPlaceholder("Describe your filter");
const queryBox = (page: Page) => page.locator('[data-testid="jql-editor-input"]').first();

runRecipe({
  file: "AUC-1134-7",
  assetId: "AT11W0",
  title: "AUC-1134 #7 - Custom filters in a team-managed space",
  product: "jira",

  async navigate(page, s) {
    // Settings pages are slow to load
    test.setTimeout(240_000);
    await openSignedIn(page, s, "/jira/software/projects/SYNC/settings/boards/368/custom-filters");
    await page.getByRole("heading", { name: "Custom filters" }).first().waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await closeTours(page);
    // With no filters yet the new filter form is already open; otherwise open it
    if (!(await nameBox(page).isVisible().catch(() => false))) await page.getByRole("button", { name: /Create custom filter/ }).first().click();
    await nameBox(page).waitFor({ timeout: 15_000 });
    // The Help panel opens by itself on this empty page; close it (display only)
    const help = page.locator('[data-testid="page-layout.aside"]');
    if (await help.isVisible().catch(() => false)) {
      await help.getByRole("button", { name: "Close" }).first().click().catch(() => {});
      await help.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }
    await nameBox(page).fill(NAME);
    await queryBox(page).click();
    await page.keyboard.type(QUERY);
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideSidebarAd(page);
    await jiraPeopleTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Space settings of a team-managed software space", async () => {
      const nav = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const ok = nav.includes("Space settings") && nav.includes("Software space");
      return { pass: ok, detail: ok ? "Present" : `Sidebar: ${nav.split("\n").slice(0, 3).join(" / ")}` };
    });

    await c.check("Settings nav: Board group with Columns and statuses, Custom filters, Card cover images, Timeline", async () => {
      const nav = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const missing = ["Board", "Columns and statuses", "Custom filters", "Card cover images", "Timeline"].filter((t) => !nav.split("\n").map((l) => l.trim()).includes(t));
      return { pass: !missing.length, detail: missing.length ? `UI change, missing: ${missing.join(", ")} (Custom filters is now a top-level item)` : "All present" };
    });

    await c.check("Page 'Custom filters' with its description", async () => {
      const h = await page.getByRole("heading", { name: "Custom filters" }).first().isVisible();
      const d = await page.getByText(/Create a reusable filter to find work on your board/).first().isVisible().catch(() => false);
      return { pass: h && d, detail: `Heading: ${h}; description: ${d}` };
    });

    await c.check("Form filled in: Name, Description, Filter query", async () => {
      const name = await nameBox(page).inputValue().catch(() => "");
      const desc = await descBox(page).isVisible().catch(() => false);
      const query = (await queryBox(page).innerText().catch(() => "")).trim();
      const label = await page.getByText("Filter query", { exact: false }).first().isVisible().catch(() => false);
      return { pass: name === NAME && desc && query === QUERY && label, detail: `Name: "${name}"; description box: ${desc}; Filter query label: ${label}; query: "${query}"` };
    });

    await c.check("Form buttons Update and Cancel", async () => {
      const update = await page.getByRole("button", { name: "Update", exact: true }).isVisible().catch(() => false);
      const create = await page.getByRole("button", { name: "Create", exact: true }).isVisible().catch(() => false);
      const cancel = await page.getByRole("button", { name: "Cancel", exact: true }).isVisible().catch(() => false);
      return { pass: update && cancel, detail: `Update: ${update}; Cancel: ${cancel}${!update && create ? " (test data: a new filter shows Create; the lesson edits an existing one)" : ""}` };
    });
  },
});
