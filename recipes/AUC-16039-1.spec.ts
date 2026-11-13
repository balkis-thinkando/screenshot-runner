// Lesson:  AUC-16039 - Govern external AI access with the Rovo MCP server
//          https://community.atlassian.com/learning/lesson/govern-external-ai-access-with-the-rovo-mcp-server
// Image:   #1, section "Authorize a domain" (domain table outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ik28v505ob3e2fg1a168vsc7d3i2q87k.png
// Recipe:  public.screenshot_recipes where asset_id = 'ik28v505ob3e2fg1a168vsc7d3i2q87k'
// The lesson shows supported domains blocked and cursor.com added. Both are org security settings, so the
// switch and the domain row are display-only fakes (owner decision, 13 Nov 2026).

import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebarLabels } from "../lib/admin";
import { anonymize, fakeButton, fakeTable, renameOrg, setCount, spotlight } from "../lib/tweaks";

const domains = '[data-testid="mcp-allowlist-table-wrapper-test-id"]';
const switchLabel = '[data-testid="toggle-atlassian-approved-domains-test-id"]';
const toggle = `${switchLabel} input`;

runRecipe({
  file: "AUC-16039-1",
  assetId: "ik28v505ob3e2fg1a168vsc7d3i2q87k",
  title: "AUC-16039 #1 - Atlassian MCP server domains",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Connectors", "Atlassian MCP server", /MCP server/);
    await page.getByText(/^Showing \d+ results?/).first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Switch shown off without clicking it (a click would save the setting). Its look comes from classes set
    // when it renders, so restyle it: grey track, knob on the left, cross icon instead of the tick
    await page.addStyleTag({
      content:
        `${switchLabel} { background-color: #8C8F97 !important; } ${switchLabel}::before { transform: none !important; } ` +
        `${switchLabel} > span:nth-of-type(1) { opacity: 0 !important; } ${switchLabel} > span:nth-of-type(2) { opacity: 1 !important; visibility: visible !important; }`,
    });
    // The empty view's container sits under the column headers; the row replaces it
    const none = page.locator('[data-testid="mcp-allowlist-paginated-table-test-id--container"]').filter({ hasText: "No domain added" });
    if (await none.isVisible()) {
      await fakeTable(page, none, [{ label: "Domain" }, { label: "Actions", width: "15%", align: "right" }], [["https://cursor.com", { html: fakeButton("Delete") }]], { header: false });
      await setCount(page, page.getByText(/^Showing 0 results/), "Showing 1 result");
    }
    // Outline the domain list, as in the lesson
    await spotlight(page, page.locator('[data-testid="cursor-paginated-table"]'), { markers: false });
  },

  async checks(page, c) {
    await c.check("Sidebar: Connectors > All connectors, Code context, Atlassian MCP server", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Connectors", "All connectors", "Code context", "Atlassian MCP server"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title reads 'Atlassian MCP server'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Atlassian MCP server", detail: `"${h1}"` };
    });

    await c.check("Tabs: Domains, Permissions, Authentication", async () => {
      const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.trim());
      const pass = JSON.stringify(tabs) === JSON.stringify(["Domains", "Permissions", "Authentication"]);
      return { pass, detail: `Tabs: ${tabs.join(", ") || "none"}` };
    });

    await c.check("Switch 'Allow Atlassian supported domains'", async () => {
      const label = await page.getByText("Allow Atlassian supported domains", { exact: true }).isVisible();
      const sw = (await page.locator(toggle).count()) > 0;
      return { pass: label && sw, detail: `Label: ${label ? "present" : "missing"}; switch: ${sw ? "present" : "missing"}` };
    });

    await c.check("Your domains: Add domain button, Search by domain, Domain and Actions columns", async () => {
      const add = await page.getByRole("button", { name: "Add domain", exact: true }).isVisible();
      const search = await page.getByPlaceholder("Search by domain").isVisible();
      const cols = (await page.locator(domains).getByText("Domain", { exact: true }).isVisible()) && (await page.locator(domains).getByText("Actions", { exact: true }).isVisible());
      return { pass: add && search && cols, detail: `Add domain: ${add}; search: ${search}; columns: ${cols}` };
    });
  },
});
