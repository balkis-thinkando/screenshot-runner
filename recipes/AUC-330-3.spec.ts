// Lesson:  AUC-330 — How do you administer an Atlassian organization?
//          https://community.atlassian.com/learning/lesson/how-do-you-administer-an-atlassian-organization
// Image:   #3, section "Administer an organization" (base image of the labelled graphic
//          "0265-Pages available in Atlassian Administration")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/gdtaqu87645h2sxi76m7qq0tgg15a86g.png
// Recipe:  public.screenshot_recipes where asset_id = 'gdtaqu87645h2sxi76m7qq0tgg15a86g'

import { runRecipe } from "../lib/recipe";
import { openOrgOverview, sidebar, orgSwitcher } from "../lib/admin";
import { renameOrg, anonymize, hideMessages, spotlight } from "../lib/tweaks";

// Sidebar menu items, without the organization switcher above them
const navItems = `${sidebar} a, ${sidebar} button:not(${orgSwitcher})`;

runRecipe({
  file: "AUC-330-3",
  assetId: "gdtaqu87645h2sxi76m7qq0tgg15a86g",
  title: "AUC-330 #3 — Atlassian Administration sidebar tabs",
  product: "admin",

  navigate: openOrgOverview,

  async tweak(page, s) {
    await hideMessages(page, ["We decluttered the left navigation"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    await spotlight(page, navItems);
  },

  // Only the sidebar matters; the dimmed page behind it changes daily
  mask: (page) => [page.locator('[data-testid*="chart"]')],

  async checks(page, c, s) {
    await c.check("Sidebar items in this order: Overview, Directory, Apps, Security, Data management, Insights, Billing, Organization settings", async () => {
      const expected = ["Overview", "Directory", "Apps", "Security", "Data management", "Insights", "Billing", "Organization settings"];
      const actual = (await page.locator(navItems).allInnerTexts())
        .map((t) => t.replace(/\s*New\s*$/, "").trim())
        .filter((t) => t && t !== s.display_org_name);
      const same = JSON.stringify(actual) === JSON.stringify(expected);
      const added = actual.filter((t) => !expected.includes(t));
      const removed = expected.filter((t) => !actual.includes(t));
      return {
        pass: same,
        detail: same ? "Same items, same order" : `Now: ${actual.join(", ")}. Added: ${added.join(", ") || "none"}. Removed or renamed: ${removed.join(", ") || "none"}.`,
      };
    });

    await c.check("Organization switcher at the top of the sidebar", async () => {
      const text = (await page.locator(orgSwitcher).innerText()).trim();
      return { pass: text === s.display_org_name, detail: `Shows "${text}"` };
    });

    await c.check("Page title reads '<organization name> overview'", async () => {
      const h1 = (await page.locator("h1").innerText()).trim();
      return { pass: h1 === `${s.display_org_name} overview`, detail: `"${h1}"` };
    });

    await c.check("Top bar labelled Administration, with a search box and no Invite users button", async () => {
      const label = await page.getByText("Administration", { exact: true }).first().isVisible();
      const search = await page.getByPlaceholder("Search").first().isVisible();
      const inviteInTopBar = await page.getByRole("button", { name: "Invite users" }).evaluateAll((els) =>
        els.some((e) => e.getBoundingClientRect().top < 60),
      );
      const problems = [!label && "Administration label missing", !search && "search box missing", inviteInTopBar && "Invite users button present"].filter(Boolean);
      return { pass: problems.length === 0, detail: problems.length ? problems.join(", ") : "As expected" };
    });
  },
});
