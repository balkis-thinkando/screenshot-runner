// Lesson:  AUC-1792 — Navigate Confluence administration
//          https://community.atlassian.com/learning/lesson/navigate-confluence-administration
// Image:   #2, section "Get to know the monitoring and admin tools in Confluence administration."
//          (base image of the labelled graphic "0422-Navigate Confluence administration")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/t66rf724vxp4p7f7kvo1pdm2qx5jp585.png
// Recipe:  public.screenshot_recipes where asset_id = 't66rf724vxp4p7f7kvo1pdm2qx5jp585'

import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, spotlight } from "../lib/tweaks";

// Items with a hotspot in the lesson: every Monitoring and Admin tools link, plus the Atlassian administration heading
const hotspots = [
  "admin-center", "site-analytics", "auditlog", "global-automation", "user-access", "permissions-export",
  "permissions-combinations", "space-manager", "announcement-banner", "importer-status-dashboard",
].map((id) => `${adminNav} a[data-testid="${id}"]`).concat("#admin-navigation-atlassian-administration-heading").join(", ");

runRecipe({
  file: "AUC-1792-2",
  assetId: "t66rf724vxp4p7f7kvo1pdm2qx5jp585",
  title: "AUC-1792 #2 — Confluence administration monitoring and admin tools",
  product: "confluence",

  navigate: openConfluenceAdmin,

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    // Outline from the Monitoring heading down to Billing
    await spotlight(page, page.locator(`#admin-navigation-monitoring-heading, ${adminNav} a[data-testid="billing"]`), {
      markersOn: page.locator(hotspots),
    });
  },

  // Only the sidebar matters; Mission control content (banner, counts, suggestions) changes
  mask: (page) => [page.locator(mainContent)],

  async checks(page, c) {
    await c.check("Page title reads 'Mission control'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Mission control", detail: `"${h1}"` };
    });

    await c.check(
      "Sidebar: Monitoring (Mission control, Analytics, Audit log), Admin tools (Automation, User access audit, Permissions data export, Transition to roles, Spaces, Announcements, Import from other tools), Atlassian administration (User management, Groups, Billing)",
      async () => {
        const labels = await adminNavLabels(page);
        const end = labels.indexOf("Settings");
        return sameOrder(end >= 0 ? labels.slice(0, end) : labels, [
          "Monitoring", "Mission control", "Analytics", "Audit log",
          "Admin tools", "Automation", "User access audit", "Permissions data export", "Transition to roles", "Spaces", "Announcements", "Import from other tools",
          "Atlassian administration", "User management", "Groups", "Billing",
        ]);
      },
    );
  },
});
