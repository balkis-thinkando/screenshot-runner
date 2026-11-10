// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #7, section "Configure default space access"
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12O8N9.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12O8N9'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages } from "../lib/tweaks";

const permissionItems = [
  "Site permissions", "Roles central", "Bulk space access", "Space roles", "System operations", "Space defaults",
  "Space management", "Guest access", "App permissions", "Analytics permissions",
];
// Default access in the lesson: user class and role
const LESSON_DEFAULTS = ["All Confluence users | User class | Collaborator", "All Confluence admins | User class | Admin"];

const groupButton = (page: Page, name: string) => page.locator(`${adminNav} button[data-testid="${name}"]`);
const main = (page: Page) => page.locator(mainContent);

/** Opens a settings group in the Confluence administration sidebar (display state only). */
async function expandGroup(page: Page, name: string) {
  const button = groupButton(page, name);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

/** Scrolls the administration sidebar so the given link sits right below its sticky header. */
async function scrollSidebarTo(page: Page, linkText: string) {
  await page.locator(`${adminNav} a`, { hasText: linkText }).first().evaluate((el) => {
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += el.getBoundingClientRect().top - 108;
  });
}

/** The lesson shows no unread count on the bell; hide the badge (display only). */
async function hideNotificationCount(page: Page) {
  await page.locator('[data-testid="top-nav-notifications-button"]').evaluate((btn) => {
    const scope = btn.parentElement ?? btn;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>("*"))) {
      if (/^\d+\+?$/.test(el.innerText?.trim() ?? "") && !el.querySelector("svg")) el.style.visibility = "hidden";
    }
  });
}

const rows = (page: Page) => main(page).locator('[data-testid="space-roles-table--body"] tr');

runRecipe({
  file: "AUC-1708-7",
  assetId: "AT12O8N9",
  title: "AUC-1708 #7 - Space defaults (defaults for new spaces)",
  product: "confluence",

  async navigate(page, s) {
    // Confluence administration > Permissions > Space defaults
    await openConfluenceAdmin(page, s);
    await expandGroup(page, "Permissions");
    await page.locator(`${adminNav} a[data-testid="space-defaults-site-admin"]`).click();
    await page.locator("h1", { hasText: "Space defaults" }).waitFor({ timeout: 60_000 });
    await rows(page).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
  },

  async tweak(page) {
    // "Choose a role" onboarding tour on the Role column: hidden, not dismissed (dismissing is saved for the account)
    await hideMessages(page, ["Your site now has roles", "Choose a role"]);
    await anonymize(page);
    await hideNotificationCount(page);
    // The lesson sidebar shows the end of Security and the whole Permissions group
    await expandGroup(page, "Security");
    await page.waitForTimeout(500);
    await scrollSidebarTo(page, "Anonymous access");
    await page.mouse.move(1000, 700); // no hover highlight
    await page.waitForTimeout(500);
  },

  async checks(page, c) {
    await c.check("Page title reads 'Space defaults'", async () => {
      const h1 = (await main(page).locator("h1").first().innerText()).trim();
      return { pass: h1 === "Space defaults", detail: `"${h1}"` };
    });

    await c.check(`Permissions group: ${permissionItems.join(", ")}`, async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Permissions");
      const end = labels.indexOf("Look and feel");
      return sameOrder(start >= 0 ? labels.slice(start + 1, end > start ? end : undefined) : [], permissionItems);
    });

    await c.check("Users section with an 'Add people' button", async () => {
      const heading = await main(page).getByText("Users", { exact: true }).first().isVisible();
      const add = await main(page).locator('[data-testid="add-defaults-button"]').isVisible();
      const label = add ? (await main(page).locator('[data-testid="add-defaults-button"]').innerText()).trim() : "";
      const pass = heading && label === "Add people";
      return { pass, detail: pass ? "Present" : `Users heading ${heading ? "present" : "missing"}; button: ${label || "not found"}` };
    });

    await c.check("Table columns: People with default access, Role", async () => {
      const heads = (await main(page).locator('[data-testid="space-roles-table--head"] th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      return sameOrder(heads, ["People with default access", "Role"]);
    });

    await c.check(`Test data: default access is ${LESSON_DEFAULTS.join("; ")}`, async () => {
      const found = await rows(page).evaluateAll((trs) =>
        trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll("td")).map((td) => (td as HTMLElement).innerText.split("\n").map((t) => t.trim()).filter(Boolean));
          return [...(cells[0] ?? []).slice(0, 2), (cells[1] ?? [])[0] ?? ""].join(" | ");
        }),
      );
      return sameOrder(found, LESSON_DEFAULTS);
    });

    await c.check("Each row has a role picker and a More (...) menu", async () => {
      const n = await rows(page).count();
      const pickers = await rows(page).getByRole("combobox").count();
      const menus = await rows(page).locator('[data-testid="table-actions-menu"]').count();
      const pass = n > 0 && pickers === n && menus === n;
      return { pass, detail: `${n} rows, ${pickers} role pickers, ${menus} More menus` };
    });

    await c.check("Public links section with the 'Allow public links in all new spaces' toggle", async () => {
      const heading = await main(page).getByText("Public links", { exact: true }).first().isVisible();
      const toggle = await main(page).locator('[data-testid="public-links-default-space-settings-toggle"]').isVisible();
      const label = await main(page).getByText("Allow public links in all new spaces", { exact: true }).isVisible();
      const pass = heading && toggle && label;
      return { pass, detail: pass ? "Present" : `Heading ${heading ? "present" : "missing"}, toggle ${toggle ? "present" : "missing"}, label ${label ? "present" : "missing"}` };
    });

    await c.check("Test data: public links are allowed in new spaces (toggle on)", async () => {
      const on = await main(page).locator('[data-testid="public-links-default-space-settings-toggle--input"]').isChecked();
      return { pass: on, detail: on ? "On" : "Off" };
    });
  },
});
