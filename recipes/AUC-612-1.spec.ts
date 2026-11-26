// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #1, section "Configure attachment settings" (Jira admin settings > System > Attachments; the sidebar item
//          and the page content are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/8145x1740y245g8e7ec4alxb0qc4pj46
// Recipe:  public.screenshot_recipes where asset_id = '8145x1740y245g8e7ec4alxb0qc4pj46'
// Opens Settings > System > Attachments with the sidebar scrolled to Advanced > Attachments. Read only: Edit Settings
// is not clicked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, checkTexts, heading, jadminTweaks, mainText, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

runRecipe({
  file: "AUC-612-1",
  assetId: "8145x1740y245g8e7ec4alxb0qc4pj46",
  title: "AUC-612 #1 - Attachments settings",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/ViewAttachmentSettings.jspa", heading(page, "Attachments"), "Attachment settings");
    await scrollSidebarTo(page, "Attachments");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    // Two outlined areas, as in the lesson: the sidebar item and the page content (title to the ZIP setting)
    await spotlightAreas(page, [sidebarLink(page, "Attachments"), [heading(page, "System"), page.getByText("Search Jira admin").first(), page.getByText(/as a single ZIP file/).first()]]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "System");
    await checkSidebar(c, page, "Sidebar: Advanced > Attachments (selected), Events, WebHooks, LexoRank management", ["Advanced", "Attachments", "Events", "WebHooks", "LexoRank management", "Filters", "Dashboards"], "Attachments");

    await c.check("Heading 'Attachments' with Edit Settings button", async () => {
      const text = await mainText(page);
      const edit = /Edit Settings/.test(text);
      return { pass: edit, detail: `Edit Settings: ${edit}` };
    });

    await checkTexts(c, page, "Note: Create Attachments permission needed", ["users must have Create Attachments permission"]);
    await checkTexts(c, page, "Settings: Attachment Size, Enable ZIP support", ["Attachment Size", "The total upload size limit of attachments.", "Enable ZIP support"]);
  },
});
