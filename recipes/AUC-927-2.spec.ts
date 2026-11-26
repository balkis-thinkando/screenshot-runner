// Lesson:  AUC-927 - Use forms to collect specific information for a request type
//          https://community.atlassian.com/learning/lesson/use-jira-service-management-forms-to-collect-information-for-a-request-type
// Image:   #2, section "Create forms" ('Select a form template' page: search, category list (All, Business, Customer service... with counts), Blank and 'Popular for Business' templates with Select buttons)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14Q54.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q54'
// Opens IT Support (ITS) space settings > Forms and clicks Create form > Create from template,
// which shows the template gallery. No template is
// selected, so no form is created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const CATEGORIES = ["All", "Business", "Customer service", "Design", "Facilities", "Finance", "HR", "IT", "Legal", "Marketing", "Sales"];

runRecipe({
  file: "AUC-927-2",
  assetId: "AT14Q54",
  title: "AUC-927 #2 - Form template gallery",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/servicedesk/projects/ITS/settings/forms", (p) => p.getByRole("button", { name: "Create form" }));
    await page.getByRole("button", { name: "Create form" }).first().click();
    // Nov 2026: Create form is a menu (Create from template, Create blank); the gallery is behind "Create from template"
    const fromTemplate = page.getByRole("menuitem", { name: /Create from template/ }).or(page.getByText("Create from template", { exact: true })).first();
    await fromTemplate.waitFor({ timeout: 10_000 }).then(() => fromTemplate.click()).catch(() => {});
    await page.getByText("Select a form template").first().waitFor({ timeout: 30_000 });
    // Not settle(): its Escape would close the gallery if it is a dialog
    await page.waitForTimeout(3_000);
    await page.mouse.move(1279, 799);
  },

  tweak: (page, s) => jsmTweaks(page, s),

  async checks(page, c) {
    await checkTexts(c, "Heading 'Select a form template' and 'select Blank to create your own form'", page, ["Select a form template", "Blank"]);
    await c.check("Search templates box", async () => {
      const v = await page.getByPlaceholder(/Search templates/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await checkTexts(c, `Categories: ${CATEGORIES.join(", ")}`, page, CATEGORIES);
    await checkTexts(c, "'Popular for Business' templates (Attend conference, Meeting notes, Retrospective...)", page, ["Popular for Business", "Attend conference", "Meeting notes", "Retrospective"]);
    await c.check("Select buttons on the templates", async () => {
      const n = await page.getByRole("button", { name: /^Select/ }).count();
      return { pass: n > 3, detail: `${n} Select buttons` };
    });
    await c.check("Language picker 'English (US)'", async () => {
      const v = await page.getByText("English (US)").first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
