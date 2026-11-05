import { Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Shared navigation for Atlassian Administration (admin.atlassian.com) recipes.

export const sidebar = '[data-testid="side-nav-view"]';
export const orgSwitcher = '[data-testid="org-selector-dropdown--trigger"]';

/** Opens the Overview page of the test organization. */
export async function openOrgOverview(page: Page, s: Settings) {
  // Step 1: open Atlassian Administration as an org admin
  await page.goto("https://admin.atlassian.com/");

  // Step 2: pick the test organization if the account administers several.
  // Wait for either the organization list or an org page (isVisible() does not wait).
  const orgLink = page.getByRole("link", { name: s.test_org, exact: true });
  await orgLink.or(page.locator(sidebar)).first().waitFor({ timeout: 30_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (await orgLink.isVisible()) {
    await orgLink.click();
  } else if (!(await page.locator(sidebar).isVisible())) {
    throw new Blocked(`Organization "${s.test_org}" not found in the organization list`);
  }

  // Step 3: make sure Overview is open
  await page.locator(sidebar).waitFor();
  if (!/overview$/i.test(await page.locator("h1").innerText())) {
    await page.locator(sidebar).getByRole("link", { name: "Overview", exact: true }).click();
  }
  await page.locator("h1", { hasText: /overview$/i }).waitFor();
  await page.locator('[data-testid*="chart"] svg').first().waitFor(); // charts rendered
  // Monitor cards keep loading after the first chart appears; give them time to settle
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}
