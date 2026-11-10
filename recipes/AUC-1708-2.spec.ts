// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #2, section "Edit site permissions" ("0425-edit-user-groups-global-permissions")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT16SPX.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SPX'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg, spotlight } from "../lib/tweaks";

const sitePermissionsLink = (page: Page) => page.locator(`${adminNav} a[data-testid="site-permissions-site-admin"]`);
const groupsTab = (page: Page) => page.locator('[data-testid="global-perms-Internal-tab"]');
const editButton = (page: Page) => groupsTab(page).getByRole("button", { name: "Edit", exact: true });

// Permissions items visible in the lesson sidebar
const lessonPermissions = ["Site permissions", "Roles central", "Bulk space access", "Space roles", "System operations", "Space defaults", "Space management", "Guest access", "App permissions"];

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
  file: "AUC-1708-2",
  assetId: "AT16SPX",
  title: "AUC-1708 #2 - Site permissions, Edit",
  product: "confluence",

  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await openSitePermissions(page);
  },

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Sidebar as in the lesson: the Settings group at the top
    await scrollSidebarTo(page, "#admin-side-nav-settings-heading", 140);
    await spotlight(page, editButton(page), { markers: false });
  },

  // The lesson image shows the top 737px of the window
  clip: { x: 0, y: 0, width: 1280, height: 737 },

  // Notification count changes
  mask: (page) => [page.locator('[data-testid="top-nav-notifications-button"]')],

  async checks(page, c) {
    await c.check("Page title reads 'Site permissions' with Manage groups, Filters and an Edit button right of the search box", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const manage = await page.getByRole("link", { name: "Manage groups" }).isVisible();
      const filters = await page.getByRole("button", { name: "Filters", exact: true }).isVisible();
      const edit = await editButton(page).boundingBox();
      const search = await page.getByPlaceholder("Enter group name").boundingBox();
      const pass = h1 === "Site permissions" && manage && filters && !!edit && !!search && edit.x > search.x;
      return { pass, detail: `"${h1}", Manage groups ${manage ? "present" : "missing"}, Filters ${filters ? "present" : "missing"}, Edit ${edit ? "present" : "missing"}` };
    });

    await c.check("Groups table columns: Groups (n), Personal Space, Create Space", async () => {
      const heads = (await groupsTab(page).locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const pass = heads.length === 3 && /^Groups \(\d+\)$/.test(heads[0]) && heads[1] === "Personal Space" && heads[2] === "Create Space";
      return { pass, detail: `Now: ${heads.join(", ")}` };
    });

    // Lesson step: select Edit, then the Personal space or Create space check boxes. Cancel only, never Save.
    await c.check("Edit turns both columns into check boxes for every group, with Cancel and Save", async () => {
      await editButton(page).click();
      const boxes = groupsTab(page).locator('input[type="checkbox"]');
      await boxes.first().waitFor({ timeout: 10_000 }).catch(() => {});
      const labels = await boxes.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
      const rows = await groupsTab(page).locator("tbody tr").count();
      const personal = labels.filter((l) => l.endsWith(", Personal Space")).length;
      const create = labels.filter((l) => l.endsWith(", Create Space")).length;
      const cancel = groupsTab(page).getByRole("button", { name: "Cancel", exact: true });
      const save = await groupsTab(page).getByRole("button", { name: "Save", exact: true }).isVisible();
      const hasCancel = await cancel.isVisible();
      if (hasCancel) await cancel.click();
      await editButton(page).waitFor({ timeout: 10_000 }).catch(() => {});
      const pass = rows > 0 && personal === rows && create === rows && hasCancel && save;
      return {
        pass,
        detail: `${rows} groups; ${personal} Personal Space and ${create} Create Space check boxes; Cancel ${hasCancel ? "present" : "missing"}, Save ${save ? "present" : "missing"}`,
      };
    });

    await c.check(`Sidebar: Permissions group lists ${lessonPermissions.join(", ")}`, async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Permissions");
      const end = labels.indexOf("Look and feel");
      const items = start >= 0 ? labels.slice(start + 1, end > start ? end : undefined) : [];
      // The lesson image is cut off after App permissions
      const last = items.indexOf("App permissions");
      return sameOrder(last >= 0 ? items.slice(0, last + 1) : items, lessonPermissions);
    });
  },
});
