// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #3, section "Assign a space to a guest." (tab "Default space for future guests")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT16SPU.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SPU'
//
// The test site has no guests yet, so the Default space section and the guest list are not shown and the
// Default space setup dialog can't be opened. The guest-list selectors below follow the lesson image and
// have not been tried on the live page.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, hideMessages, neutralNames, renameOrg } from "../lib/tweaks";

const guestAccessLink = (page: Page) => page.locator(`${adminNav} a[data-testid="guests-site-admin"]`);
const guestsTab = (page: Page) => page.locator('[data-testid="global-perms-External-tab"]');
const assignDefault = (page: Page) => page.getByRole("button", { name: "Assign default space" }).or(page.getByRole("link", { name: "Assign default space" })).first();
const setupDialog = (page: Page) => page.getByRole("dialog").filter({ hasText: "Default space setup" });

/** Settings > Permissions > Guest access in the Confluence administration sidebar. */
async function openGuestAccess(page: Page) {
  const link = guestAccessLink(page);
  if (!(await link.isVisible())) await page.locator(`${adminNav} [data-testid="Permissions"]`).click();
  await link.click();
  await page.locator("h1", { hasText: "Guest access" }).waitFor({ timeout: 60_000 });
  await guestsTab(page).waitFor({ timeout: 30_000 });
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
  file: "AUC-1708-3",
  assetId: "AT16SPU",
  title: "AUC-1708 #3 - Guest access, Default space setup",
  product: "confluence",

  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await openGuestAccess(page);
  },

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    // Sidebar as in the lesson: the Permissions group near the top
    await scrollSidebarTo(page, `${adminNav} [data-testid="Permissions"]`, 160);
    // Names first: anonymize() then turns the avatars into initials
    await neutralNames(page, "Guest");
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // Lesson steps: Assign default space, then pick a space in the dropdown (never Save)
    if (await assignDefault(page).isVisible()) {
      await assignDefault(page).click();
      await setupDialog(page).waitFor({ timeout: 10_000 });
      await setupDialog(page).getByRole("combobox").first().click();
      const option = page.getByRole("option").first();
      await option.waitFor({ timeout: 10_000 });
      await option.click();
      await page.waitForTimeout(500);
    }
  },

  // The lesson image shows the top 737px of the window
  clip: { x: 0, y: 0, width: 1280, height: 737 },

  // Notification count and the guest list change
  mask: (page) => [page.locator('[data-testid="top-nav-notifications-button"]'), guestsTab(page).locator("tbody")],

  async checks(page, c) {
    await c.check("Page title reads 'Guest access'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Guest access", detail: `"${h1}"` };
    });

    await c.check("Test data: the site has at least one guest", async () => {
      const empty = await page.getByText("No guests added yet", { exact: true }).isVisible();
      return { pass: !empty, detail: empty ? "No guests on the test site (page shows 'No guests added yet'); add a guest to show the lesson screen" : "Guests listed" };
    });

    await c.check("Default space section: 'Default space: ...' with 'All future guest users will be automatically added to this space.' and Assign default space", async () => {
      const heading = await guestsTab(page).getByText(/^Default space:/).first().isVisible();
      const text = await guestsTab(page).getByText("All future guest users will be automatically added to this space.", { exact: false }).first().isVisible();
      const link = await assignDefault(page).isVisible();
      const missing = [!heading && "Default space: heading", !text && "description", !link && "Assign default space"].filter(Boolean);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Assign default space opens 'Default space setup' with a Default space dropdown, Learn more, Cancel and Save", async () => {
      const dialog = setupDialog(page);
      if (!(await dialog.isVisible())) return { pass: false, detail: "Dialog not open (Assign default space not found)" };
      const label = await dialog.getByText("Default space", { exact: true }).isVisible();
      const text = await dialog.getByText("All future guest users will be automatically added to this space.").isVisible();
      const learn = await dialog.getByRole("link", { name: /Learn more/ }).isVisible();
      const cancel = await dialog.getByRole("button", { name: "Cancel", exact: true }).isVisible();
      const save = await dialog.getByRole("button", { name: "Save", exact: true }).isVisible();
      const missing = [!label && "Default space label", !text && "description", !learn && "Learn more", !cancel && "Cancel", !save && "Save"].filter(Boolean);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Guest list: search 'Enter a name or email', Guests with no access, More filters, columns Guest and Confluence access, a check box per guest", async () => {
      const search = await page.getByPlaceholder("Enter a name or email").isVisible();
      const noAccess = await page.getByRole("button", { name: "Guests with no access" }).isVisible();
      const more = await page.getByRole("button", { name: /More filters/ }).isVisible();
      const heads = (await guestsTab(page).locator("thead th").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const cols = heads.includes("Guest") && heads.some((h) => h.startsWith("Confluence access"));
      const rows = await guestsTab(page).locator("tbody tr").count();
      const boxes = await guestsTab(page).locator('tbody tr input[type="checkbox"]').count();
      const missing = [!search && "search", !noAccess && "Guests with no access", !more && "More filters", !cols && "Guest / Confluence access columns", (!rows || boxes < rows) && "row check boxes"].filter(Boolean);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}${heads.length ? `. Columns now: ${heads.join(", ")}` : ""}` : "All present" };
    });

    await c.check("Sidebar: Guest access (selected) under Permissions", async () => {
      const current = (await guestAccessLink(page).getAttribute("aria-current")) === "page";
      return { pass: current, detail: current ? "Selected" : "Guest access is not marked as the current page" };
    });
  },
});
