// Lesson:  AUC-16036 - Administer Rovo
//          https://community.atlassian.com/learning/lesson/administer-rovo
// Image:   #1, section "Allow or block Rovo" (no annotations)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/635034gpe07bw2k7e4ln6h7m727c0ua1.png
// Recipe:  public.screenshot_recipes where asset_id = '635034gpe07bw2k7e4ln6h7m727c0ua1'
// The lesson shows Confluence on the blocklist. Blocking it would turn Rovo off for the test site, so the row
// is a display-only fake.

import { runRecipe } from "../lib/recipe";
import { appIconHtml, openOrgOverview, openOrgPath, sidebarLabels } from "../lib/admin";
import { anonymize, fakeButton, fakeTable, renameOrg, setCount } from "../lib/tweaks";

let confluenceIcon = "";

runRecipe({
  file: "AUC-16036-1",
  assetId: "635034gpe07bw2k7e4ln6h7m727c0ua1",
  title: "AUC-16036 #1 - Rovo access blocklist",
  product: "admin",

  async navigate(page, s) {
    await openOrgOverview(page, s);
    confluenceIcon = await appIconHtml(page, "Confluence");
    // Open the page fresh so the sidebar only expands AI and Rovo, as in the lesson
    await openOrgPath(page, s, "rovo-access", /Rovo access/);
    await page.getByText(/^Showing \d+ items?$/).first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no hover highlight left on the sidebar
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Only when the blocklist is empty: one blocked app, as in the lesson
    const empty = page.locator('[data-testid="rovo-access-apps"] [data-testid="empty-state-stack"]');
    if (await empty.isVisible()) {
      const site = `${s.display_org_name.toLowerCase()}.atlassian.net/wiki`;
      await fakeTable(page, empty, [{ label: "App", width: "50%" }, { label: "Plan" }, { label: "Actions", width: "12%", align: "right" }], [[
        { html: `<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:inline-flex;width:32px">${confluenceIcon}</span><span><span style="display:block">Confluence</span><span style="display:block;font-size:12px;color:#505258">${site}</span></span></span>` },
        "Enterprise",
        { html: fakeButton("Remove") },
      ]]);
      await setCount(page, page.getByText(/^Showing 0 items$/), "Showing 1 item");
    }
  },

  async checks(page, c) {
    await c.check("Sidebar: AI and Rovo > Overview, Trends, Access, Agents, Rovo settings", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["AI and Rovo", "Access", "Agents", "Rovo settings"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title reads 'Rovo access'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Rovo access", detail: `"${h1}"` };
    });

    await c.check("Blocklist section with an Add app button", async () => {
      const heading = await page.getByText("Blocklist", { exact: true }).isVisible();
      const add = await page.getByRole("button", { name: "Add app", exact: true }).isVisible();
      return { pass: heading && add, detail: `Blocklist heading: ${heading ? "present" : "missing"}; Add app: ${add ? "present" : "missing"}` };
    });

    await c.check("Search by name box and Apps filter", async () => {
      const search = await page.getByPlaceholder("Search by name").isVisible();
      const filter = await page.getByRole("button", { name: /^Apps/ }).first().isVisible();
      return { pass: search && filter, detail: `Search: ${search ? "present" : "missing"}; Apps filter: ${filter ? "present" : "missing"}` };
    });
  },
});
