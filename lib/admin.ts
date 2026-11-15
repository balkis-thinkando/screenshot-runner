import { Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Shared navigation for Atlassian Administration (admin.atlassian.com) recipes.

export const sidebar = '[data-testid="side-nav-view"]';
export const orgSwitcher = '[data-testid="org-selector-dropdown--trigger"]';

/** Opens the Overview page of the test organization. */
export async function openOrgOverview(page: Page, s: Settings) {
  // Step 1: open Atlassian Administration as an org admin
  // Wait for content below, not the load event (the admin page doesn't always fire it)
  await page.goto("https://admin.atlassian.com/", { waitUntil: "commit" });

  // Step 2: pick the test organization if the account administers several.
  // Wait for either the organization list or an org page (isVisible() does not wait).
  const orgLink = page.getByRole("link", { name: s.test_org, exact: true });
  await orgLink.or(page.locator(sidebar)).first().waitFor({ timeout: 60_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (await orgLink.isVisible()) {
    await orgLink.click();
  } else if (!(await page.locator(sidebar).isVisible())) {
    throw new Blocked(`Organization "${s.test_org}" not found in the organization list`);
  }

  // Step 3: make sure Overview is open
  // Selecting an org usually lands on Overview; the title can take a few seconds to render
  await page.locator(sidebar).waitFor();
  const title = page.locator("h1", { hasText: /overview$/i });
  if (!(await title.waitFor({ timeout: 20_000 }).then(() => true, () => false))) {
    await page.keyboard.press("Escape"); // onboarding pop-ups (e.g. "We decluttered...") cover the sidebar
    await page.locator(sidebar).getByRole("link", { name: "Overview", exact: true }).click();
    await title.waitFor();
  }

  // Close onboarding pop-ups (e.g. "We decluttered the left navigation"); hiding them leaves the page dimmed
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible()) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
  await page.locator('[data-testid*="chart"] svg').first().waitFor(); // charts rendered
  // Monitor cards keep loading after the first chart appears; give them time to settle
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/** Opens an organization page from the sidebar: a section (e.g. "AI and Rovo"), then one of its items (e.g. "Access"). */
export async function openOrgPage(page: Page, s: Settings, section: string, item: string, title: RegExp) {
  await openOrgOverview(page, s);
  await goToOrgPage(page, section, item, title);
}

/** From any organization page, opens another one from the sidebar (no reload of Overview). */
export async function goToOrgPage(page: Page, section: string, item: string, title: RegExp) {
  const nav = page.locator(sidebar);
  const link = nav.getByRole("link", { name: item, exact: true }).first();
  // Clicking a section that is already open would close it
  if (!(await link.isVisible())) {
    await nav.getByRole("button", { name: section, exact: true }).or(nav.getByRole("link", { name: section, exact: true })).first().click();
  }
  await link.click();
  await page.locator("h1", { hasText: title }).waitFor();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Icon of an app (e.g. "Confluence") as HTML, from the Atlassian apps page, for display-only fakes elsewhere. */
export async function appIconHtml(page: Page, app: string) {
  await goToOrgPage(page, "Apps", "Atlassian apps", /Atlassian apps/);
  const icon = page.locator(`[data-testid="product-card-icon-container"]`).filter({ has: page.locator(`[aria-label="${app}"]`) }).first();
  await icon.waitFor();
  return icon.innerHTML();
}

/** Opens an organization page by its path (e.g. "ip-allowlists"), for pages nested deep in the sidebar. */
export async function openOrgPath(page: Page, s: Settings, path: string, title: RegExp) {
  if (!page.url().includes("admin.atlassian.com/o/")) await openOrgOverview(page, s);
  const org = page.url().match(/\/o\/[0-9a-f-]+/)![0];
  await page.goto(`https://admin.atlassian.com${org}/${path}`, { waitUntil: "commit" });
  await page.locator("h1", { hasText: title }).waitFor({ timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

/** Sidebar link labels, trimmed, for checks. */
export async function sidebarLabels(page: Page) {
  return (await page.locator(`${sidebar} a, ${sidebar} button`).allInnerTexts()).map((t) => t.replace(/\s*New\s*$/, "").trim()).filter(Boolean);
}
