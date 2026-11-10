// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #4, section "Allow or block public links on your Confluence site." ("0425-public-links")
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT16SPR.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SPR'
//
// Never turns the real "Allow public links on this site" setting on or off, and never applies an action
// from the bulk menu: it only ticks one space and opens the menu.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg, spotlight } from "../lib/tweaks";

const publicLinksLink = (page: Page) => page.locator(`${adminNav} a[data-testid="public-links-site-admin"]`);
const siteToggle = (page: Page) => page.locator("#public-links-setting-toggle");
// The toggle and its label
const toggleRow = (page: Page) => page.locator('label[for="public-links-setting-toggle"]').locator("..");
const spaceTable = (page: Page) => page.locator('[data-testid="selection-table-view-container"]');
const rowBoxes = (page: Page) => spaceTable(page).locator('[data-testid="bulk-selection--checkbox-label"]');
const bulkMore = (page: Page) => page.locator('[data-testid="public-links-table-cta-quick-actions-trigger"]');

/** Settings > Security > Public links in the Confluence administration sidebar. */
async function openPublicLinks(page: Page) {
  const link = publicLinksLink(page);
  if (!(await link.isVisible())) await page.locator(`${adminNav} [data-testid="Security"]`).click();
  await link.click();
  await page.locator("h1", { hasText: "Public links" }).waitFor({ timeout: 60_000 });
  await rowBoxes(page).first().waitFor({ timeout: 30_000 });
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

/** Personal spaces are named after people: show them as User A, User B... */
async function neutralPersonalSpaces(page: Page) {
  await spaceTable(page).evaluate((table) => {
    const names = new Map<string, string>();
    for (const a of Array.from(table.querySelectorAll<HTMLAnchorElement>('a[href*="/spaces/~"]'))) {
      const key = a.getAttribute("href")!;
      if (!names.has(key)) names.set(key, `User ${String.fromCharCode(65 + names.size)}`);
      if (a.innerText.trim()) a.textContent = names.get(key)!;
    }
  });
}

let toggleWasOff = false;

runRecipe({
  file: "AUC-1708-4",
  assetId: "AT16SPR",
  title: "AUC-1708 #4 - Public links, bulk actions menu",
  product: "confluence",

  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await openPublicLinks(page);
  },

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    // Sidebar as in the lesson: scrolled to the top (Monitoring)
    await scrollSidebarTo(page, "#admin-navigation-monitoring-heading", 160);
    await neutralPersonalSpaces(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // The lesson shows the site setting on. If it is off on the test site, show it on (display only, not saved).
    toggleWasOff = !(await siteToggle(page).isChecked());
    if (toggleWasOff) {
      await siteToggle(page).evaluate((input: HTMLInputElement) => {
        input.checked = true;
        input.closest("label")?.setAttribute("data-checked", "true");
      });
    }
    // Lesson steps: tick a space (the second one, as in the lesson), then open the bulk menu. Never pick an item.
    await rowBoxes(page).nth(1).click();
    await bulkMore(page).waitFor({ timeout: 10_000 });
    await bulkMore(page).click();
    await page.getByRole("menu").getByRole("menuitem").first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await spotlight(page, toggleRow(page), { markers: false });
  },

  // Public link counts and views change
  mask: (page) => [page.locator('[data-testid="top-nav-notifications-button"]')],

  async checks(page, c) {
    await c.check("Page title reads 'Public links'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Public links", detail: `"${h1}"` };
    });

    await c.check("Description: 'With public links, you can let your Confluence users share content...' and 'You can decide which spaces should allow public links...', with Learn more about public links", async () => {
      const first = await page.getByText(/^With public links, you can let your Confluence users share content with anyone on the internet\./).isVisible();
      const second = await page.getByText(/^You can decide which spaces should allow public links\./).isVisible();
      const learn = await page.getByRole("link", { name: /^Learn more about public links/ }).isVisible();
      const missing = [!first && "first paragraph", !second && "second paragraph", !learn && "Learn more about public links"].filter(Boolean);
      return { pass: !missing.length, detail: missing.length ? `Missing or reworded: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Toggle 'Allow public links on this site' above the spaces list", async () => {
      const label = await page.getByText("Allow public links on this site", { exact: true }).isVisible();
      const toggle = await toggleRow(page).boundingBox();
      const search = await page.getByPlaceholder("Search for a space").boundingBox();
      const pass = label && !!toggle && !!search && toggle.y < search.y;
      return { pass, detail: label ? (pass ? "Present, above the list" : "Present, but not above the spaces list") : "Not found" };
    });

    await c.check("Test data: 'Allow public links on this site' is on", async () => {
      return { pass: !toggleWasOff, detail: toggleWasOff ? "Off on the test site; shown on in the capture by a display-only edit" : "On" };
    });

    // Once a space is ticked, the bulk actions bar replaces the column headers (as in the lesson)
    await c.check("Spaces list: search 'Search for a space', Filters; each row has a check box, space name, status (Allowed or Blocked) and a public links count", async () => {
      const search = await page.getByPlaceholder("Search for a space").isVisible();
      const filters = await page.getByRole("button", { name: "Filters", exact: true }).isVisible();
      const rows = await spaceTable(page).getByRole("row").evaluateAll((trs) =>
        trs
          .filter((tr) => tr.querySelector('[data-testid="bulk-selection--hidden-checkbox"]'))
          .map((tr) => ({
            name: !!tr.querySelector("a")?.textContent?.trim(),
            status: /\b(Allowed|Blocked|Not allowed)\b/i.test((tr as HTMLElement).innerText),
            count: !!Array.from(tr.querySelectorAll("button")).find((b) => /^\d+$/.test(b.textContent?.trim() ?? "")),
          })),
      );
      const bad = rows.filter((r) => !r.name || !r.status || !r.count).length;
      const missing = [!search && "search", !filters && "Filters"].filter(Boolean);
      const pass = !missing.length && rows.length > 0 && !bad;
      return { pass, detail: `${missing.length ? `Missing: ${missing.join(", ")}. ` : ""}${rows.length} rows, ${bad} without a name, status or count` };
    });

    await c.check("Ticking a space shows '1 total', Stop allowing, Block and a more actions (...) button, in that order", async () => {
      const bar = await page.getByText("1 total", { exact: true }).boundingBox();
      const stop = await page.getByRole("button", { name: "Stop allowing", exact: true }).boundingBox();
      const block = await page.getByRole("button", { name: "Block", exact: true }).boundingBox();
      const more = await bulkMore(page).boundingBox();
      const pass = !!bar && !!stop && !!block && !!more && bar.x < stop.x && stop.x < block.x && block.x < more.x;
      const missing = [!bar && "1 total", !stop && "Stop allowing", !block && "Block", !more && "more actions"].filter(Boolean);
      return { pass, detail: missing.length ? `Missing: ${missing.join(", ")}` : pass ? "All present, in order" : "All present, different order" };
    });

    await c.check("More actions menu: Allow, Unblock", async () => {
      const items = (await page.getByRole("menu").getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
      const pass = JSON.stringify(items) === JSON.stringify(["Allow", "Unblock"]);
      return { pass, detail: `Now: ${items.join(", ") || "menu not open"}` };
    });

    await c.check("Sidebar: Public links (selected) under Security", async () => {
      const current = (await publicLinksLink(page).getAttribute("aria-current")) === "page";
      return { pass: current, detail: current ? "Selected" : "Public links is not marked as the current page" };
    });
  },
});
