// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #1, section "What are site permissions?" ("0425-site-permissions")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT16SPY.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SPY'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, arrowTo, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

const sitePermissionsLink = (page: Page) => page.locator(`${adminNav} a[data-testid="site-permissions-site-admin"]`);
const groupsTab = (page: Page) => page.locator('[data-testid="global-perms-Internal-tab"]');

/** Settings > Permissions > Site permissions in the Confluence administration sidebar. */
async function openSitePermissions(page: Page) {
  const link = sitePermissionsLink(page);
  if (!(await link.isVisible())) await page.locator(`${adminNav} [data-testid="Permissions"]`).click();
  await link.click();
  await page.locator("h1", { hasText: "Site permissions" }).waitFor({ timeout: 60_000 });
  await groupsTab(page).locator("tbody tr").first().waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

/** Scrolls the admin sidebar so the element's top sits at the given height in the window. */
async function scrollSidebarTo(page: Page, selector: string, top: number) {
  await page.locator(selector).first().evaluate((el, top) => {
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += el.getBoundingClientRect().top - top;
  }, top);
  await page.waitForTimeout(300);
}

runRecipe({
  file: "AUC-1708-1",
  assetId: "AT16SPY",
  title: "AUC-1708 #1 - Site permissions, User groups",
  product: "confluence",

  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await openSitePermissions(page);
  },

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Sidebar as in the lesson: Import from other tools at the top, Site permissions near the bottom
    await scrollSidebarTo(page, `${adminNav} a[data-testid="importer-status-dashboard"]`, 150);
    const link = sitePermissionsLink(page);
    const h1 = page.locator("h1", { hasText: "Site permissions" });
    await spotlightAreas(page, [link, [h1, page.getByRole("link", { name: "Manage groups" }), groupsTab(page)]]);
    // White arrow from above Site permissions up to the groups list
    const l = (await link.boundingBox())!;
    const tab = (await groupsTab(page).boundingBox())!;
    await arrowTo(page, groupsTab(page), { offsetY: Math.max(20, l.y - 170 - tab.y) });
  },

  // The lesson image shows the top 737px of the window
  clip: { x: 0, y: 0, width: 1280, height: 737 },

  // Notification count changes
  mask: (page) => [page.locator('[data-testid="top-nav-notifications-button"]')],

  async checks(page, c) {
    await c.check("Page title reads 'Site permissions' with a Manage groups button", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const manage = await page.getByRole("link", { name: "Manage groups" }).isVisible();
      return { pass: h1 === "Site permissions" && manage, detail: `"${h1}", Manage groups ${manage ? "present" : "missing"}` };
    });

    await c.check("Description: 'Manage what different groups of users can do on your Confluence site.' with Learn more", async () => {
      const text = await page.getByText("Manage what different groups of users can do on your Confluence site.").isVisible();
      const learn = await page.getByRole("link", { name: /^Learn more/ }).first().isVisible();
      return { pass: text && learn, detail: `Description ${text ? "present" : "missing or reworded"}, Learn more ${learn ? "present" : "missing"}` };
    });

    await c.check("Groups list has a search box 'Enter group name', Filters and Edit", async () => {
      const search = await page.getByPlaceholder("Enter group name").isVisible();
      const filters = await page.getByRole("button", { name: "Filters", exact: true }).isVisible();
      const edit = await page.getByRole("button", { name: "Edit", exact: true }).isVisible();
      const missing = [!search && "search", !filters && "Filters", !edit && "Edit"].filter(Boolean);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Groups table columns: Groups (n), Personal Space, Create Space", async () => {
      const heads = (await groupsTab(page).locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const pass = heads.length === 3 && /^Groups \(\d+\)$/.test(heads[0]) && heads[1] === "Personal Space" && heads[2] === "Create Space";
      return { pass, detail: `Now: ${heads.join(", ")}` };
    });

    await c.check("Each group shows a member count and a granted or denied icon for both permissions", async () => {
      const rows = await groupsTab(page).locator("tbody tr").evaluateAll((trs) =>
        trs.map((tr) => ({
          members: /\d+ members?/.test((tr as HTMLElement).innerText),
          icons: tr.querySelectorAll('[aria-label="Permission granted"], [aria-label="Permission denied"]').length,
        })),
      );
      const bad = rows.filter((r) => !r.members || r.icons !== 2).length;
      return { pass: rows.length > 0 && !bad, detail: `${rows.length} groups, ${bad} without a member count or two icons` };
    });

    await c.check("Sidebar: Permissions group starts with Site permissions (selected), Roles central, Bulk space access", async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Permissions");
      const selected = (await sitePermissionsLink(page).getAttribute("aria-current")) === "page";
      const order = sameOrder(start >= 0 ? labels.slice(start + 1, start + 4) : [], ["Site permissions", "Roles central", "Bulk space access"]);
      return { pass: order.pass && selected, detail: `${order.detail}${selected ? "" : "; Site permissions is not marked as the current page"}` };
    });

    await c.check("Test data: at least three groups have Personal Space and Create Space permissions", async () => {
      const granted = await groupsTab(page).locator("tbody tr").evaluateAll(
        (trs) => trs.filter((tr) => tr.querySelectorAll('[aria-label="Permission granted"]').length === 2).length,
      );
      return { pass: granted >= 3, detail: `${granted} groups have both permissions (the lesson shows three)` };
    });
  },
});
