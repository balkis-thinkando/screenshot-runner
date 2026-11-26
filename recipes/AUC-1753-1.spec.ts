// Lesson:  AUC-1753 - Prioritize work with the List view in Jira
//          https://community.atlassian.com/learning/lesson/using-jira-list-view
// Image:   #1, section "What is the List view?" (Employee Onboarding List view, three epics expanded)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14MJX.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14MJX'
// The Employee Onboarding (EO) List view with epics EO-1, EO-6 and EO-8 expanded (expanding rows changes nothing on
// the site). The sidebar is hidden, display only, as in the lesson. People are shown with fake names.

import { runRecipe } from "../lib/recipe";
import { expandRows, fakeSpacePeople, hideJiraSidebar, listColumns, listToolbarCheck, openSpaceView, tabsCheck, keyLink } from "../lib/b3-jsearch";

runRecipe({
  file: "AUC-1753-1",
  assetId: "AT14MJX",
  title: "AUC-1753 #1 - List view with epics expanded",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/core/projects/EO/list", keyLink(page, "EO-1"), "the EO List view");
    await expandRows(page, ["EO-1", "EO-6", "EO-8"]);
    await keyLink(page, "EO-9").waitFor({ timeout: 15_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideJiraSidebar(page);
    await fakeSpacePeople(page, s, ["EO"]);
  },

  async checks(page, c) {
    await c.check("Space 'Employee Onboarding'", async () => {
      const h = await page.getByRole("heading", { name: "Employee Onboarding" }).first().isVisible().catch(() => false);
      return { pass: h, detail: h ? "Present" : "Missing" };
    });

    await tabsCheck(page, c, "List", ["Summary", "Board", "List", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports", "Archived work items"]);
    await listToolbarCheck(page, c);

    await c.check("Columns: Work, Assignee, Reporter, Priority, Status, Resolution", async () => {
      const cols = await listColumns(page);
      const missing = ["Work", "Assignee", "Reporter", "Priority", "Status", "Resolution"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}${missing.length ? `; missing: ${missing.join(", ")} (the view's column settings, site data)` : ""}` };
    });

    await c.check("Epics EO-1, EO-6, EO-8 expanded with their child work items", async () => {
      const keys = (await page.locator("table tbody tr").allInnerTexts()).map((t) => /EO-\d+/.exec(t)?.[0]).filter(Boolean);
      const want = ["EO-1", "EO-2", "EO-3", "EO-4", "EO-5", "EO-6", "EO-7", "EO-8", "EO-9", "EO-10", "EO-11"];
      const missing = want.filter((k) => !keys.includes(k));
      return { pass: !missing.length, detail: `Rows: ${keys.join(", ")}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Footer: Create and '4 of 4'", async () => {
      const create = await page.getByRole("button", { name: "Create", exact: true }).last().isVisible().catch(() => false);
      const count = await page.getByText(/^\d+ of \d+\+?$/).first().innerText().catch(() => "");
      return { pass: create && count === "4 of 4", detail: `Create: ${create}; count: "${count}"` };
    });
  },
});
