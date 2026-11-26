// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #5, section "Create application links" (Jira admin settings > Jira apps > Integrations > Application links;
//          the sidebar item and the page content are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/m857l6170uo8o767l5531evqu8062x78
// Recipe:  public.screenshot_recipes where asset_id = 'm857l6170uo8o767l5531evqu8062x78'
// Opens Settings > Apps > Application links. Read only: Create link and the row's actions menu are not clicked. The
// Confluence version number changes with each release, so it is masked.

import { runRecipe } from "../lib/recipe";
import { hideMessages, spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, checkTexts, heading, jadminTweaks, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

runRecipe({
  file: "AUC-612-5",
  assetId: "m857l6170uo8o767l5531evqu8062x78",
  title: "AUC-612 #5 - Application links",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/plugins/servlet/applinks/listApplicationLinks", heading(page, "Application links"), "Application links");
    await page.getByText("System Confluence").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await scrollSidebarTo(page, "Application links");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    // An "Incident management" promotion pops up on this page for some accounts; the lesson does not show it
    await hideMessages(page, ["Incident management"]);
    await spotlightAreas(page, [sidebarLink(page, "Application links"), [heading(page, "Application links"), page.getByRole("button", { name: "Create link" }).first(), page.locator("table").first()]]);
  },

  mask: (page) => [page.getByText(/^Confluence \d+\.\d+/)],

  async checks(page, c) {
    await checkSwitchSettings(c, page, "Jira apps");
    await checkSidebar(c, page, "Sidebar: Integrations > Application links (selected), Compass, DVCS accounts", ["Integrations", "Application links", "Compass", "DVCS accounts"], "Application links");

    await c.check("Heading 'Application links' with Create link button", async () => {
      const create = await page.getByRole("button", { name: "Create link" }).first().isVisible().catch(() => false);
      return { pass: create, detail: `Create link: ${create}` };
    });

    await checkTexts(c, page, "Intro text and OAuth 2.0 message", ["Application links let you integrate Jira", "Learn more about application links", "OAuth 2.0 application links are now available!", "How to create an OAuth 2.0 application link"]);

    await c.check("Columns: Application, Version, Link type, Status", async () => {
      const cols = (await page.locator("table").first().locator("th").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const missing = ["Application", "Version", "Link type", "Status"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await checkTexts(c, page, "Row: System Confluence, PRIMARY, Direct link, SYSTEM", ["System Confluence", "PRIMARY", "Direct link", "SYSTEM"], page.locator("table").first());
  },
});
