// Lesson:  AUC-606 - Configure global user interface features in Jira
//          https://community.atlassian.com/learning/lesson/configure-global-user-interface-features-in-jira
// Image:   #1, section "Customize the user experience in Jira" (Jira admin settings > System > General
//          configuration; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/8bre2axksw4v68gq234jhdc0t4l7u770.png
// Recipe:  public.screenshot_recipes where asset_id = '8bre2axksw4v68gq234jhdc0t4l7u770'
// Opens Settings > System > General configuration. Read only: Edit Settings and Advanced Settings are not clicked.

import { runRecipe } from "../lib/recipe";
import { checkSidebar, checkSwitchSettings, checkTexts, heading, jadminTweaks, openSettingsPage } from "../lib/b3-jadmin";

runRecipe({
  file: "AUC-606-1",
  assetId: "8bre2axksw4v68gq234jhdc0t4l7u770",
  title: "AUC-606 #1 - System general configuration",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/jira/settings/system/general-configuration", heading(page, "System settings"), "General configuration");
    await page.getByText("General Settings", { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "System");
    await checkSidebar(c, page, "Sidebar: General configuration (selected), Audit log, Space roles, Global permissions, Default user preferences, Default dashboard, Look and feel",
      ["General configuration", "Audit log", "Site optimizer", "Space roles", "Global permissions", "Work item collectors", "Global automation", "Default user preferences", "Default dashboard", "Look and feel", "Announcement banner", "Backup manager", "External system import"],
      "General configuration");

    await c.check("Page title 'System settings' with Advanced Settings and Edit Settings buttons", async () => {
      const title = await page.getByText("System settings", { exact: true }).first().isVisible().catch(() => false);
      const adv = await page.getByRole("button", { name: "Advanced Settings" }).or(page.getByRole("link", { name: "Advanced Settings" })).first().isVisible().catch(() => false);
      const edit = await page.getByRole("button", { name: "Edit Settings" }).or(page.getByRole("link", { name: "Edit Settings" })).first().isVisible().catch(() => false);
      return { pass: title && adv && edit, detail: `Title: ${title}; Advanced Settings: ${adv}; Edit Settings: ${edit}` };
    });

    await checkTexts(c, page, "General Settings: Title, Email from, Introduction", ["General Settings", "Title", "Email from", "Introduction"]);
    await checkTexts(c, page, "Internationalization: Indexing language and installed languages", ["Internationalization", "Indexing language", "English (United States)"]);
  },
});
