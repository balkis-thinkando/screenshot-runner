// Lesson:  AUC-13464 - Configure how fields appear on work items in company-managed spaces
//          https://community.atlassian.com/learning/lesson/configure-how-fields-appear-on-work-items-in-company-managed-projects
// Image:   #1, section "Configure the layout for work items" (Space settings > Work items > Layout of the Marketing
//          Content business space; the Layout sidebar item and "Work types in this space" are outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT12KW.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12KW'
// Opens Space settings > Layout of Marketing Content (MC, the lesson's space). Read only: Edit work item layout is not
// clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkTexts, heading, jadminTweaks, mainText, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

const editLink = (page: Page) => page.getByText("Edit work item layout", { exact: true }).first();

runRecipe({
  file: "AUC-13464-1",
  assetId: "AT12KW",
  title: "AUC-13464 #1 - Space settings Work item layout",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/plugins/servlet/project-config/MC/issuelayout", editLink(page), "Work item layout of Marketing Content");
    await scrollSidebarTo(page, "Layout");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    const title = page.getByText(/^Work types in this (space|project)$/).first();
    await spotlightAreas(page, [sidebarLink(page, "Layout"), [title, editLink(page), page.getByText(/These work types show the fields defined in/).first()]]);
  },

  async checks(page, c) {
    await checkSidebar(c, page, "Sidebar: Space settings of Marketing Content, Work items > Types, Layout (selected), Screens, Fields, Collectors, Security",
      ["Space settings", "Marketing Content", "Details", "Summary", "People", "Permissions", "Automation", "Workflows", "Work items", "Types", "Layout", "Screens", "Fields", "Collectors", "Security", "Versions", "Components"], "Layout");

    await c.check("Breadcrumb Spaces / Marketing Content / Space settings, heading 'Work Item layout'", async () => {
      const t = await page.locator("body").innerText();
      const crumb = /Spaces[\s\S]*Marketing Content[\s\S]*Space settings/.test(t);
      const h = /Work [Ii]tem layout/.test(t);
      const projectWording = /Project settings/.test(t);
      return { pass: crumb && h, detail: `Breadcrumb with 'Space settings': ${crumb}${projectWording ? " (shows 'Project settings')" : ""}; heading: ${h}` };
    });

    await checkTexts(c, page, "Intro text with 'screen settings' link and the two notes", ["This page lets you set the visibility and order of fields", "screen settings", "Note:", "Field order in the global screen configuration won't affect the layout"]);

    await c.check("Section 'Work types in this space' with work types and 'Edit work item layout'", async () => {
      const t = await mainText(page);
      const title = /Work types in this space/.test(t);
      const old = /Work types in this project/.test(t);
      const missing = ["Marketing Asset", "Campaign", "Deliverable", "Task", "Sub-task", "Edit work item layout"].filter((w) => !t.includes(w));
      return { pass: title && !missing.length, detail: `Title: ${title ? "space" : old ? "'Work types in this project' (lesson: space)" : "missing"}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await checkTexts(c, page, "Screen used: MC: Content Management Edit/View Issue Screen", ["These work types show the fields defined in", "MC: Content Management Edit/View Issue Screen"]);
  },
});
