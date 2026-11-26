// Lesson:  AUC-13464 - Configure how fields appear on work items in company-managed spaces
//          https://community.atlassian.com/learning/lesson/configure-how-fields-appear-on-work-items-in-company-managed-projects
// Image:   #3, section "What can you change in the layout?" (work item layout editor of Marketing Content with the Due
//          date field being dragged between Assignee and Reporter; the editor is outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/7h2c20goaey8js5gkf83ur86uyx5gf4j.png
// Recipe:  public.screenshot_recipes where asset_id = '7h2c20goaey8js5gkf83ur86uyx5gf4j'
// Opens Space settings > Layout of Marketing Content (MC) and clicks Edit work item layout. A drag in progress cannot
// be held for a screenshot, so it is a display-only fake: a copy of the Due date row is shown lifted between Assignee
// and Reporter (the real row is hidden) and the drop area gets the dashed outline. Nothing is dragged on the site
// and Save changes is never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, jadminTweaks, openSettingsPage, scrollToShow } from "../lib/b3-jadmin";

const row = (page: Page, key: string) => page.locator(`li[draggable]:has([data-testid$="field-key-${key}"])`).first();
const title = (page: Page) => page.getByText(/^Work item layout for /).first();

/** Display-only drag state: Due date lifted between Assignee and Reporter. Returns false if a row is missing. */
async function fakeDrag(page: Page) {
  return page.evaluate(() => {
    const li = (key: string) => document.querySelector(`[data-testid$="field-key-${key}"]`)?.closest("li[draggable]") as HTMLElement | null;
    const due = li("duedate");
    const assignee = li("assignee");
    if (!due || !assignee) return false;
    const copy = due.cloneNode(true) as HTMLElement;
    copy.setAttribute("data-screenshot-fake", "dragged-row");
    copy.style.cssText += ";transform:translateX(28px);box-shadow:0 8px 12px rgba(9,30,66,.15),0 0 1px rgba(9,30,66,.31);border-radius:4px;background:#fff;position:relative;z-index:2";
    due.style.display = "none";
    assignee.after(copy);
    const list = assignee.parentElement as HTMLElement;
    list.style.outline = "2px dashed #388BFF";
    list.style.outlineOffset = "4px";
    // The list's scrolling area, for the outline (the lesson outlines the editor down to the last visible row)
    let sc: HTMLElement | null = list;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    (sc ?? list).setAttribute("data-jadmin", "layout-list");
    return true;
  });
}

let faked = false;

runRecipe({
  file: "AUC-13464-3",
  assetId: "7h2c20goaey8js5gkf83ur86uyx5gf4j",
  title: "AUC-13464 #3 - Work item layout editor, dragging a field",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/plugins/servlet/project-config/MC/issuelayout", page.getByText("Edit work item layout", { exact: true }).first(), "Work item layout of Marketing Content");
    await page.getByText("Edit work item layout", { exact: true }).first().click();
    await row(page, "labels").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
    // The lesson's list starts at Labels, right under the work types
    await scrollToShow(page, row(page, "labels"), 380);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    faked = await fakeDrag(page);
    await spotlightAreas(page, [[title(page), page.locator('[data-jadmin="layout-list"]').or(page.locator('[data-screenshot-fake="dragged-row"]')).first()]]);
  },

  async checks(page, c) {
    await checkSidebar(c, page, "Sidebar: Space settings of Marketing Content, Work items > Layout (selected)", ["Space settings", "Marketing Content", "Work items", "Types", "Layout", "Screens", "Fields"], "Layout");

    await c.check("Breadcrumb ends with 'Work item layout'; title 'Work item layout for \"MC: Content Management Edit/View ... Screen\"'", async () => {
      const t = await page.locator("body").innerText();
      const crumb = /Space settings\s*\/?\s*\n?\s*Work item layout/.test(t) || t.includes("Work item layout");
      const tt = (await title(page).innerText().catch(() => "")).trim();
      const ok = /MC: Content Management Edit\/View (Work Item|Issue) Screen/.test(tt);
      return { pass: crumb && ok, detail: `Title: "${tt.slice(0, 90)}"${/Issue Screen/.test(tt) ? " (lesson: Work Item Screen)" : ""}` };
    });

    await c.check("Intro: Drag fields..., Learn how your fields appear in the work item., screen link", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Drag fields to choose where to show them", "Learn how your fields appear in the work item."].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Work types bar: Campaign, Deliverable, Marketing Asset, Task, Sub-task", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Campaign", "Deliverable", "Marketing Asset", "Task", "Sub-task"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Field rows: Labels, Assignee, Reporter, Start date, Priority, Category (Due date shown mid-drag, faked)", async () => {
      const missing: string[] = [];
      for (const k of ["labels", "assignee", "reporter", "priority"]) if (!(await row(page, k).count())) missing.push(k);
      const t = await page.locator("body").innerText();
      for (const w of ["Start date", "Category"]) if (!t.includes(w)) missing.push(w);
      return { pass: faked && !missing.length, detail: `Drag fake: ${faked ? "shown" : "not shown (Due date or Assignee row missing)"}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Fields panel (Search all fields, Date and time fields) and footer (Discard, Copy work item layout, Save changes)", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Search all fields", "Date and time fields", "Give feedback", "Discard", "Copy work item layout", "Save changes"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
