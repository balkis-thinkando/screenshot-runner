// Lesson:  AUC-1792 — Navigate Confluence administration
//          https://community.atlassian.com/learning/lesson/navigate-confluence-administration
// Image:   #1, section "Access Confluence administration"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ttrpillql6np016tgq85w770w0p170kn.png
// Recipe:  public.screenshot_recipes where asset_id = 'ttrpillql6np016tgq85w770w0p170kn'

import { runRecipe } from "../lib/recipe";
import { adminButton, mainContent, openConfluenceHome } from "../lib/confluence";
import { anonymize, arrowTo, hideMessages, spotlight } from "../lib/tweaks";

runRecipe({
  file: "AUC-1792-1",
  assetId: "ttrpillql6np016tgq85w770w0p170kn",
  title: "AUC-1792 #1 — Confluence administration icon",
  product: "confluence",

  navigate: openConfluenceHome,

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await spotlight(page, adminButton(page), { markers: false });
    await arrowTo(page, adminButton(page));
  },

  // The lesson image shows only the top of the page
  clip: { x: 0, y: 0, width: 1321, height: 470 },

  // Recent pages and the feed depend on the account's activity
  mask: (page) => [page.locator(mainContent)],

  async checks(page, c) {
    await c.check("Top bar has the Confluence administration (settings) icon, right of Help", async () => {
      const gear = await adminButton(page).boundingBox();
      const help = await page.getByRole("button", { name: "Help", exact: true }).first().boundingBox();
      const pass = !!gear && !!help && gear.x > help.x && gear.y < 60;
      return { pass, detail: gear ? (pass ? "Present, right of Help" : "Present, but not right of Help in the top bar") : "Not found" };
    });

    await c.check("Top bar: Search, Create, Ask Rovo", async () => {
      const missing: string[] = [];
      if (!(await page.getByPlaceholder("Search").first().isVisible())) missing.push("Search");
      if (!(await page.getByRole("button", { name: "Create", exact: true }).first().isVisible())) missing.push("Create");
      if (!(await page.getByRole("button", { name: "Ask Rovo" }).first().isVisible())) missing.push("Ask Rovo");
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Sidebar starts with: For you, Recent, Starred, Spaces, Apps", async () => {
      const expected = ["For you", "Recent", "Starred", "Spaces", "Apps"];
      const missing = [];
      for (const t of expected) if (!(await page.getByRole("link", { name: t, exact: true }).or(page.getByRole("button", { name: t, exact: true })).first().isVisible())) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Test data: Pick up where you left off lists recent pages", async () => {
      const section = await page.getByText("Pick up where you left off", { exact: true }).isVisible();
      const empty = await page.getByText("Start something great").isVisible();
      const pass = section && !empty;
      return { pass, detail: pass ? "Recent pages shown" : "No recent pages for the test account (it has not visited any pages yet)" };
    });
  },
});
