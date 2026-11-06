// Lesson:  AUC-1792 — Navigate Confluence administration
//          https://community.atlassian.com/learning/lesson/navigate-confluence-administration
// Image:   #3, section "Get to know the different settings in Confluence administration."
//          (base image of the labelled graphic "0422-explore-different-settings-in-Confluence-administration")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/tytpt6vy377quhqr652h4a81v17or54r.png
// Recipe:  public.screenshot_recipes where asset_id = 'tytpt6vy377quhqr652h4a81v17or54r'

import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, spotlight } from "../lib/tweaks";

const settingsItems = ["Configuration", "Security", "Permissions", "Look and feel", "Data management", "Atlassian marketplace"];
const settingsButtons = settingsItems.map((t) => `${adminNav} [data-testid="${t}"]`).join(", ");

runRecipe({
  file: "AUC-1792-3",
  assetId: "tytpt6vy377quhqr652h4a81v17or54r",
  title: "AUC-1792 #3 — Confluence administration settings",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    // Scroll the sidebar so the Settings group sits at the bottom, as in the lesson
    await page.locator(`${adminNav} [data-testid="Atlassian marketplace"]`).evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(500);
    await spotlight(page, page.locator(`#admin-side-nav-settings-heading, ${adminNav} input[placeholder^="Jump to setting"], ${settingsButtons}`), {
      markersOn: page.locator(settingsButtons),
    });
  },

  mask: (page) => [page.locator(mainContent)],

  async checks(page, c) {
    await c.check(`Settings group: ${settingsItems.join(", ")}`, async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Settings");
      return sameOrder(start >= 0 ? labels.slice(start + 1) : [], settingsItems);
    });

    await c.check("Settings has a 'Jump to setting...' search box", async () => {
      const visible = await page.locator(`${adminNav} input[placeholder^="Jump to setting"]`).isVisible();
      return { pass: visible, detail: visible ? "Present" : "Not found" };
    });
  },
});
