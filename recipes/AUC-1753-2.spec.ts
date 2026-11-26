// Lesson:  AUC-1753 - Prioritize work with the List view in Jira
//          https://community.atlassian.com/learning/lesson/using-jira-list-view
// Image:   #2, section "What is the List view?" (BiteBring Launch Squad List view filtered to one assignee:
//          Filter shows 1)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14MK7.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14MK7'
// The BLS28 List view filtered (in the page address only, nothing saved) to the assignee of BLS28-4, the person the
// lesson filters on. The sidebar is hidden, display only, as in the lesson. People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { fakeSpacePeople, hideJiraSidebar, listColumns, listToolbarCheck, openSpaceView, tabsCheck, keyLink } from "../lib/b3-jsearch";

const people = (page: Page) => page.locator('[data-testid^="filters.ui.filters.assignee"] input[type="checkbox"]');
const filterButton = (page: Page) => page.getByRole("button", { name: /^Filter/ }).first();

runRecipe({
  file: "AUC-1753-2",
  assetId: "AT14MK7",
  title: "AUC-1753 #2 - List view with one filter",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/c/projects/BLS28/list", keyLink(page, "BLS28-4"), "the BLS28 List view");
    // The person the lesson filters on: the assignee of BLS28-4
    const id: string | null = await page.evaluate(async () => {
      const r = await fetch("/rest/api/3/issue/BLS28-4?fields=assignee").then((x) => (x.ok ? x.json() : null)).catch(() => null);
      return r?.fields?.assignee?.accountId ?? null;
    });
    const n = await people(page).count();
    let box = -1;
    for (let i = 0; i < n && id; i++) {
      const html = await people(page).nth(i).evaluate((el) => `${el.getAttribute("value")} ${el.id} ${el.getAttribute("name")} ${el.closest("label")?.outerHTML.slice(0, 2000) ?? ""}`);
      if (html.includes(id)) { box = i; break; }
    }
    if (box < 0) throw new Error(`Assignee of BLS28-4 not found among the ${n} people filter avatars`);
    // The checkbox itself is hidden under the avatar: click the avatar (unless the filter is already on)
    if (!(await people(page).nth(box).isChecked())) {
      const pic = await people(page).nth(box).boundingBox();
      if (!pic) throw new Error("People filter avatar has no position");
      await page.mouse.click(pic.x + pic.width / 2, pic.y + pic.height / 2);
    }
    await page.waitForTimeout(3_000);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideJiraSidebar(page);
    await fakeSpacePeople(page, s, ["BLS28"]);
  },

  async checks(page, c) {
    await c.check("Space 'BiteBring Launch Squad' with the breadcrumb M0028 - BiteBring Launch Squad", async () => {
      const h = await page.getByRole("heading", { name: "BiteBring Launch Squad" }).first().isVisible().catch(() => false);
      const crumb = await page.locator('nav[aria-label="Breadcrumbs"]').innerText().catch(() => "");
      return { pass: h && crumb.includes("M0028 - BiteBring Launch Squad"), detail: `Heading: ${h}; breadcrumb: "${crumb.replace(/\s+/g, " ").trim()}"` };
    });

    await tabsCheck(page, c, "List", ["Summary", "Timeline", "Kanban board", "Calendar", "Reports", "List", "Forms", "Goals", "Components", "Development"]);
    await listToolbarCheck(page, c);

    await c.check("One person selected in the people filter; Filter shows 1", async () => {
      const checked = await people(page).evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length);
      const label = (await filterButton(page).innerText()).replace(/\s+/g, " ").trim();
      return { pass: checked === 1 && /\b1\b/.test(label), detail: `People selected: ${checked}; Filter button: "${label}"${/\b1\b/.test(label) ? "" : " (UI change: the people filter is not counted on Filter)"}` };
    });

    await c.check("Rows: BLS28-4, BLS28-7, BLS28-8 (3 of 3)", async () => {
      const keys = (await page.locator("table tbody tr").allInnerTexts()).map((t) => /BLS28-\d+/.exec(t)?.[0]).filter(Boolean);
      const count = await page.getByText(/^\d+ of \d+\+?$/).first().innerText().catch(() => "");
      const ok = ["BLS28-4", "BLS28-7", "BLS28-8"].every((k) => keys.includes(k)) && keys.length === 3;
      return { pass: ok, detail: `Rows: ${keys.join(", ")}; count: "${count}"` };
    });

    await c.check("Columns: Work, Assignee, Priority, Status, Resolution, Created", async () => {
      const cols = await listColumns(page);
      const missing = ["Work", "Assignee", "Priority", "Status", "Resolution", "Created"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}${missing.length ? `; missing: ${missing.join(", ")} (the view's column settings, site data)` : ""}` };
    });

    await c.check("Refresh button and Create in the footer", async () => {
      const create = await page.getByRole("button", { name: "Create", exact: true }).last().isVisible().catch(() => false);
      const refresh = await page.getByRole("button", { name: /refresh/i }).first().isVisible().catch(() => false);
      return { pass: create && refresh, detail: `Create: ${create}; refresh: ${refresh}` };
    });
  },
});
