// Lesson:  AUC-649 - Configure global permissions in Jira
//          https://community.atlassian.com/learning/lesson/configure-global-permissions-in-jira
// Image:   #2, section "Grant global permissions to groups" (Jira admin settings > System > Global permissions, top
//          of the page; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/p62ino13241q0xm145yecqr2o3deey7l
// Recipe:  public.screenshot_recipes where asset_id = 'p62ino13241q0xm145yecqr2o3deey7l'
// Opens Settings > System > Global permissions. Read only: View Users, Delete and Add are not clicked. Group names
// differ by site (the site name in them is replaced by the display org name), so the group list is masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkSidebar, checkSwitchSettings, checkTexts, heading, jadminTweaks, openSettingsPage } from "../lib/b3-jadmin";

const permTable = (page: Page) => page.locator("table").filter({ hasText: "Administer Jira" }).first();

runRecipe({
  file: "AUC-649-2",
  assetId: "p62ino13241q0xm145yecqr2o3deey7l",
  title: "AUC-649 #2 - Global permissions",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/GlobalPermissions!default.jspa", heading(page, "Global Permissions"), "Global permissions");
    // The page can open slightly scrolled (sidebar title cut off); the lesson shows the top
    await page.evaluate(() => { window.scrollTo(0, 0); document.scrollingElement?.scrollTo(0, 0); });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
  },

  // The groups granted each permission depend on the site
  mask: (page) => [permTable(page).locator("td:last-child")],

  async checks(page, c) {
    await checkSwitchSettings(c, page, "System");
    await checkSidebar(c, page, "Sidebar: Security > Space roles, Global permissions (selected), Work item collectors", ["Security", "Space roles", "Global permissions", "Work item collectors", "Global automation", "Default user preferences"], "Global permissions");

    await checkTexts(c, page, "Heading 'Global Permissions' with intro (Permission Schemes, application access links)", ["Global Permissions", "These permissions apply to all spaces", "Permission Schemes", "application access"]);

    await c.check("Section 'Jira Permissions', columns Permissions and Users / Groups", async () => {
      const title = await page.getByText(/Jira Permissions/).first().isVisible().catch(() => false);
      const cols = (await permTable(page).locator("th").allInnerTexts()).map((t) => t.trim());
      const ok = cols.includes("Permissions") && cols.some((c) => /Users\s*\/\s*Groups/.test(c));
      return { pass: title && ok, detail: `Title: ${title}; columns: ${cols.join(", ")}` };
    });

    await c.check("Administer Jira with 'Configure permissions in user management' link", async () => {
      const text = await permTable(page).innerText();
      const ok = text.includes("Administer Jira") && text.includes("Configure permissions in user management");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Browse users and groups with groups, View Users and Delete links", async () => {
      const text = await permTable(page).innerText();
      const ok = text.includes("Browse users and groups") && text.includes("View Users") && text.includes("Delete");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });
  },
});
