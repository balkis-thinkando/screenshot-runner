// Lesson:  AUC-16036 - Administer Rovo
//          https://community.atlassian.com/learning/lesson/administer-rovo
// Image:   #2, section "Administer Rovo in Atlassian Administration" (no annotations)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/mjgph3810lm2rysno3msa4717gn471sv.png
// Recipe:  public.screenshot_recipes where asset_id = 'mjgph3810lm2rysno3msa4717gn471sv'
// The lesson shows one inactive allowlist. Creating one is a security setting, so the row is a display-only fake.

import { runRecipe } from "../lib/recipe";
import { appIconHtml, openOrgOverview, openOrgPath, sidebarLabels } from "../lib/admin";
import { anonymize, fakeLozenge, fakeTable, renameOrg, setCount } from "../lib/tweaks";

let confluenceIcon = "";

runRecipe({
  file: "AUC-16036-2",
  assetId: "mjgph3810lm2rysno3msa4717gn471sv",
  title: "AUC-16036 #2 - IP allowlists",
  product: "admin",

  async navigate(page, s) {
    await openOrgOverview(page, s);
    confluenceIcon = await appIconHtml(page, "Confluence");
    // Security > Device security > IP allowlists; opened by path so only Security is expanded, as in the lesson
    await openOrgPath(page, s, "ip-allowlists", /IP allowlists/);
    await page.getByText(/^Showing \d+ items?$/).first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no hover highlight left on the sidebar
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    const empty = page.locator('[data-testid="empty-state-stack"]');
    if (await empty.isVisible()) {
      await fakeTable(
        page,
        empty,
        [{ label: "Name", width: "24%" }, { label: "Access origin", width: "24%" }, { label: "Applies to", width: "24%" }, { label: "Status" }, { label: "Actions", width: "10%", align: "right" }],
        [["test", "Location", { html: `<span style="display:inline-flex"><style>[data-screenshot-tweak] .icon24 svg { width: 24px; height: 24px; }</style><span class="icon24">${confluenceIcon}</span></span>` }, { html: fakeLozenge("Inactive") }, "•••"]],
      );
      await setCount(page, page.getByText(/^Showing 0 items$/), "Showing 1 item");
    }
  },

  async checks(page, c) {
    await c.check("Sidebar: Security > Device security > IP allowlists, Mobile app policies", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Security", "Device security", "IP allowlists", "Mobile app policies"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title reads 'IP allowlists' with a Create IP allowlist button", async () => {
      // The heading also holds "Powered by Atlassian Guard" on a second line
      const h1 = (await page.locator("h1").first().innerText()).split("\n")[0].trim();
      const create = await page.getByRole("button", { name: "Create IP allowlist", exact: true }).isVisible();
      return { pass: h1 === "IP allowlists" && create, detail: `"${h1}"; Create IP allowlist: ${create ? "present" : "missing"}` };
    });

    await c.check("Search box and filters: Origin, Applies to, Status", async () => {
      const search = await page.getByPlaceholder(/^Search by/).first().isVisible();
      const missing = [];
      for (const f of ["Origin", "Applies to", "Status"]) if (!(await page.getByRole("button", { name: new RegExp(`^${f}`) }).first().isVisible())) missing.push(f);
      return { pass: search && !missing.length, detail: `Search: ${search ? "present" : "missing"}; missing filters: ${missing.join(", ") || "none"}` };
    });
  },
});
