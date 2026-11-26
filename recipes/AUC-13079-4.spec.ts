// Lesson:  AUC-13079 - Define work item security for company-managed spaces with schemes
//          https://community.atlassian.com/learning/lesson/issue-security-scheme-jira
// Image:   #4, section "Add the Security Level field to work items" (Space settings > Work items > Screens of the
//          Mobile Dev company-managed software space; the sidebar's Work items group and the screen scheme are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/7y61pg7h53m474au300w1w2un8w8touh.png
// Recipe:  public.screenshot_recipes where asset_id = '7y61pg7h53m474au300w1w2un8w8touh'
// Opens Space settings > Screens of Mobile Dev (MOBL, the lesson's space). Read only: Actions and the edit (pencil)
// buttons are not clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkTexts, heading, jadminTweaks, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

const SCHEME = "MOBL: Scrum Issue Type Screen Scheme";
const WORK_ITEMS = ["Types", "Layout", "Screens", "Fields", "Collectors", "Security"];

/** The sidebar's Work items group: its toggle down to the last child item. */
const workItemsGroup = (page: Page) => [sidebarLink(page, "Work items"), sidebarLink(page, "Security"), sidebarLink(page, "Components")];

runRecipe({
  file: "AUC-13079-4",
  assetId: "7y61pg7h53m474au300w1w2un8w8touh",
  title: "AUC-13079 #4 - Space settings Screens",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/plugins/servlet/project-config/MOBL/screens", heading(page, SCHEME), "Screens of Mobile Dev");
    await scrollSidebarTo(page, "Components");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [workItemsGroup(page), [heading(page, SCHEME), page.getByText("Actions", { exact: true }).first(), page.getByText("Bug", { exact: true }).last()]]);
  },

  async checks(page, c) {
    await checkSidebar(c, page, "Sidebar: Space settings of Mobile Dev, Work items > Types, Layout, Screens (selected), Fields, Collectors, Security",
      ["Space settings", "Mobile Dev", "Summary", "People", "Permissions", "Automation", "Features", "Workflows", "Work items", ...WORK_ITEMS, "Versions", "Components"], "Screens");

    await c.check("Breadcrumb and heading 'Screens'", async () => {
      const t = await page.locator("body").innerText();
      const crumbs = t.includes("Spaces") && t.includes("Mobile Dev");
      const h = await heading(page, "Screens").isVisible().catch(() => false);
      return { pass: crumbs && h, detail: `Breadcrumb: ${crumbs}; heading: ${h}` };
    });

    await c.check(`Scheme '${SCHEME}' with Actions button`, async () => {
      const h = await heading(page, SCHEME).isVisible().catch(() => false);
      const actions = await page.getByRole("button", { name: /Actions/ }).first().isVisible().catch(() => false);
      return { pass: h && actions, detail: `Scheme: ${h}; Actions: ${actions}` };
    });

    await checkTexts(c, page, "Info message 'Layout in the new Jira work item view'", ["Layout in the new Jira work item view", "Learn more about configuring the new work item view"]);
    await checkTexts(c, page, "Screen schemes: Scrum Default (Story, Epic, Initiative, Risk, Task, Sub-task) and Scrum Bug (Bug)",
      ["This project uses 2 screen configurations.", "MOBL: Scrum Default Screen Scheme", "MOBL: Scrum Bug Screen Scheme", "Story", "Epic", "Initiative", "Risk", "Task", "Sub-task", "Bug"]);
  },
});
