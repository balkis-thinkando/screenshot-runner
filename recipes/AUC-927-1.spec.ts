// Lesson:  AUC-927 - Use forms to collect specific information for a request type
//          https://community.atlassian.com/learning/lesson/use-jira-service-management-forms-to-collect-information-for-a-request-type
// Image:   #1, section "What are forms?" (Commercial Legal Service Desk space settings > Forms, a form (Current or Prospective Customer Question) open in the builder: Build / Translate / Preview / Settings, toolbar, Add field, Add section, Back to forms, Save changes; Forms item and builder outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14Q5L.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q5L'
// Needs test data: no service space the test account administers has a form, and creating one is a change. The recipe
// reaches IT Support (ITS) space settings > Forms (closest real screen) and outlines the Forms item. Nothing is created.

import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, jsmTweaks, openAndWait, sidebarItem, outline } from "../lib/b3-jsm";
import { spotlight } from "../lib/tweaks";

runRecipe({
  file: "AUC-927-1",
  assetId: "AT14Q5L",
  title: "AUC-927 #1 - Form builder opened from space settings",
  product: "jira",

  navigate: (page, s) => openAndWait(page, s, "/jira/servicedesk/projects/ITS/settings/forms", (p) => p.getByRole("button", { name: "Create form" })),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await outline(page, sidebarItem(page, "Forms"));
  },

  async checks(page, c) {
    await checkHeading(c, "Space settings > Forms page with 'Create form'", page, "Forms");
    await checkControl(c, "'Create form' button", page, "Create form");
    await c.check("An existing form opens in the form builder", async () => {
      const empty = await page.getByText("All of your forms will show up here").first().isVisible().catch(() => false);
      return { pass: false, detail: empty ? "Needs test data: no service space the test account administers has a form (Nov 2026)" : "Forms exist: extend the recipe to open one" };
    });
    await checkTexts(c, "Form builder: Build, Translate, Preview, Settings, Add field, Add section, Back to forms, Save changes", page, ["Build", "Translate", "Preview", "Add field", "Add section", "Back to forms", "Save changes"], undefined, "Needs test data (form builder not reachable). ");
  },
});
