// Lesson:  AUC-927 - Use forms to collect specific information for a request type
//          https://community.atlassian.com/learning/lesson/use-jira-service-management-forms-to-collect-information-for-a-request-type
// Image:   #3, section "Create forms" (Form builder of Current or Prospective Customer Question with callouts on the Build/Translate/Preview/Settings tabs, the formatting toolbar, the form title, Add field and Add section)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14Q4E.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q4E'
// Needs test data: no service space the test account administers has a form, and creating one is a change. The recipe
// reaches IT Support (ITS) space settings > Forms (closest real screen). Nothing is created.

import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, jsmTweaks, openAndWait, sidebarItem, outline } from "../lib/b3-jsm";
import { spotlight } from "../lib/tweaks";

runRecipe({
  file: "AUC-927-3",
  assetId: "AT14Q4E",
  title: "AUC-927 #3 - Form builder toolbar",
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
    await checkTexts(c, "Builder tabs Build, Translate, Preview, Settings; Add field, Add section", page, ["Build", "Translate", "Preview", "Add field", "Add section"], undefined, "Needs test data (form builder not reachable). ");
  },
});
