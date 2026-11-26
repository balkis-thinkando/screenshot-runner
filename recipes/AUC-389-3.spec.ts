// Lesson:  AUC-389 - Adjust your personal settings in Jira
//          https://community.atlassian.com/learning/lesson/adjust-your-jira-personal-settings
// Image:   #3, section "Configure your Jira homepage" (the Jira homepage field and its open list are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14QDA.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14QDA'
// Opens Personal settings > General and opens the Jira homepage dropdown. No option is picked (the setting is not
// changed); the run ends with the list open.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { basicTweaks, generalPageChecks, markField, openPersonalSettings } from "../lib/b3-jreports";

const OPTIONS = ["For you", "Spaces directory", "Dashboards", "Plans directory"];
const listbox = (page: import("@playwright/test").Page) => page.locator('[role="listbox"]:visible').first();

runRecipe({
  file: "AUC-389-3",
  assetId: "AT14QDA",
  title: "AUC-389 #3 - Jira homepage dropdown open",
  product: "jira",

  async navigate(page, s) {
    await openPersonalSettings(page, s, "general");
    const home = await markField(page, "Jira homepage", "home");
    await home.control.click();
    await listbox(page).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await spotlightAreas(page, [[page.locator('[data-screenshot-label="home"]'), page.locator('[data-screenshot-field="home"]'), listbox(page)]]);
  },

  async checks(page, c) {
    await generalPageChecks(page, c);
    await c.check("Jira homepage list: For you, Spaces directory, Dashboards, Plans directory", async () => {
      const opts = (await listbox(page).locator('[role="option"]').allInnerTexts()).map((t) => t.trim());
      const missing = OPTIONS.filter((o) => !opts.includes(o));
      return { pass: !missing.length, detail: `Options: ${opts.join(", ")}` };
    });
    await c.check("'For you' is the selected option", async () => {
      const sel = (await listbox(page).locator('[role="option"][aria-selected="true"]').first().innerText().catch(() => "")).trim();
      return { pass: sel === "For you", detail: `Selected: "${sel}"` };
    });
  },
});
