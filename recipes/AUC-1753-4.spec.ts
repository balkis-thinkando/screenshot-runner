// Lesson:  AUC-1753 - Prioritize work with the List view in Jira
//          https://community.atlassian.com/learning/lesson/using-jira-list-view
// Image:   #4, section "Explore the List view" (PLAT List view; the toolbar, the checkbox column, the header row,
//          the PLAT-3 row and Create are outlined, each with a marker)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14MK5.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14MK5'
// The PLAT List view with the lesson's outlines and markers. Sidebar hidden, display only, as in the lesson.
// Which work items come first can change, so the table body is masked. People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlightAreas } from "../lib/tweaks";
import { fakeSpacePeople, hideJiraSidebar, markBox, listColumns, listToolbarCheck, openSpaceView, tabsCheck, keyLink, keyLinks } from "../lib/b3-jsearch";

const row = (page: Page, key: string) => page.locator("table tbody tr").filter({ has: keyLinks(page, key) }).first();
const createButton = (page: Page) => page.getByRole("button", { name: "Create", exact: true }).last();
const toolbarParts = (page: Page) => [
  page.getByRole("button", { name: /^(Ask )?AI$/ }).first(),
  page.getByRole("button", { name: /^Group/ }).first(),
  page.getByRole("button", { name: /^More actions$|^More$/ }).last(),
];

runRecipe({
  file: "AUC-1753-4",
  assetId: "AT14MK5",
  title: "AUC-1753 #4 - List view parts",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/c/projects/PLAT/list", keyLink(page, "PLAT-3"), "the PLAT List view");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideJiraSidebar(page);
    await fakeSpacePeople(page, s, ["PLAT"]);
    const toolbar = [];
    for (const p of toolbarParts(page)) if (await p.isVisible().catch(() => false)) toolbar.push(p);
    // Areas must not overlap (spotlightAreas pads each by 4px): the checkbox column, then the header row and the
    // PLAT-3 row right of it, each inset from the column border
    const box = (name: string, key: "checkboxes" | "header" | "row") =>
      markBox(page, name, (key) => {
        const ths = Array.from(document.querySelectorAll("table thead th"));
        const rowOf = (k: string) => Array.from(document.querySelectorAll("table tbody tr")).find((tr) => Array.from(tr.querySelectorAll("a")).some((a) => a.textContent?.trim() === k));
        const first = ths[0]?.getBoundingClientRect();
        const last = ths[ths.length - 1]?.getBoundingClientRect();
        const plat3 = rowOf("PLAT-3")?.getBoundingClientRect();
        const plat8 = rowOf("PLAT-8")?.getBoundingClientRect();
        if (!first || !last || !plat3 || !plat8) return null;
        const split = first.right;
        if (key === "checkboxes") return { left: first.left + 4, top: first.top + 4, right: split - 6, bottom: plat8.bottom - 4 };
        if (key === "header") return { left: split + 6, top: first.top + 4, right: last.right - 4, bottom: first.bottom - 4 };
        return { left: split + 6, top: plat3.top + 4, right: plat3.right - 4, bottom: plat3.bottom - 4 };
      }, key);
    const checkboxes = await box("list-checkboxes", "checkboxes");
    const header = await box("list-header", "header");
    const plat3 = await box("list-plat3", "row");
    await spotlightAreas(page, [toolbar, checkboxes, header, plat3, createButton(page)]);
    await markers(page, page.locator("table thead th").nth(2), "down", [120]);
    await markers(page, createButton(page), "left", [1]);
  },

  mask: (page) => [page.locator("table tbody"), page.getByText(/^\d+ of \d+\+?$/)],

  async checks(page, c) {
    await c.check("Space 'PLAT board' in Platform Development", async () => {
      const h = await page.getByRole("heading", { name: "PLAT board" }).first().isVisible().catch(() => false);
      return { pass: h, detail: h ? "Present" : "Missing" };
    });
    await tabsCheck(page, c, "List", ["Summary", "Timeline", "Backlog", "Active sprints", "Calendar", "Reports", "Forms", "Goals", "List"]);
    await listToolbarCheck(page, c);

    await c.check("More actions (...) at the right of the toolbar", async () => {
      const v = await toolbarParts(page)[2].isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Columns: Work, Assignee, Priority, Status, Resolution", async () => {
      const cols = await listColumns(page);
      const missing = ["Work", "Assignee", "Priority", "Status", "Resolution"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}${missing.length ? `; missing: ${missing.join(", ")} (the view's column settings, site data)` : ""}` };
    });

    await c.check("Epic rows PLAT-1 to PLAT-8 with expand arrows and a checkbox per row", async () => {
      const missing = [];
      for (let i = 1; i <= 8; i++) if (!(await row(page, `PLAT-${i}`).isVisible().catch(() => false))) missing.push(`PLAT-${i}`);
      const expand = await row(page, "PLAT-3").locator("button").first().isVisible().catch(() => false);
      const box = await row(page, "PLAT-3").locator('input[type="checkbox"]').count();
      return { pass: !missing.length && expand && box > 0, detail: `Missing rows: ${missing.join(", ") || "none"}; expand: ${expand}; checkbox: ${box > 0}` };
    });

    await c.check("Footer: Create and '50 of 1000+'", async () => {
      const create = await createButton(page).isVisible().catch(() => false);
      const count = await page.getByText(/^\d+ of \d+\+?$/).first().innerText().catch(() => "");
      return { pass: create && /^50 of/.test(count), detail: `Create: ${create}; count: "${count}"` };
    });
  },
});
