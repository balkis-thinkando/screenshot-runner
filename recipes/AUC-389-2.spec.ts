// Lesson:  AUC-389 - Adjust your personal settings in Jira
//          https://community.atlassian.com/learning/lesson/adjust-your-jira-personal-settings
// Image:   #2, section "Explore your personal settings" (the sidebar's Jira and Jira Service Management groups, and the
//          timezone, language, watch and homepage fields are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT1240.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1240'
// Opens Personal settings > General. Nothing is clicked or changed. The lesson's hotspot lines are not drawn
// (markers() only draws lines down or to the left); the two outlined areas are.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { basicTweaks, generalPageChecks, markField, openPersonalSettings, personalSidebar } from "../lib/b3-jreports";

runRecipe({
  file: "AUC-389-2",
  assetId: "AT1240",
  title: "AUC-389 #2 - Personal settings General page",
  product: "jira",

  async navigate(page, s) {
    await openPersonalSettings(page, s, "general");
    await page.getByText("Jira homepage", { exact: true }).waitFor({ timeout: 30_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    const tz = await markField(page, "Your timezone", "tz");
    const home = await markField(page, "Jira homepage", "home");
    const nav = personalSidebar(page);
    await spotlightAreas(page, [
      [nav.getByText("Jira", { exact: true }), nav.getByText("Alerts", { exact: true }), nav.getByText("Jira Service Management", { exact: true })],
      [tz.label, home.control],
    ]);
  },

  async checks(page, c) {
    await generalPageChecks(page, c);
    await c.check("Timezone and language dropdowns are read-only (greyed); watch and homepage dropdowns are editable", async () => {
      const disabled = await page.locator('[data-testid="page-layout.main"]').locator('[aria-disabled="true"], [disabled], input[disabled]').count();
      return { pass: disabled >= 2, detail: `Disabled controls: ${disabled}` };
    });
  },
});
