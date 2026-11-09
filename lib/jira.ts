import { Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Shared navigation for Jira recipes on the test site.

/**
 * Opens a site page through Atlassian sign-in. Pages that anonymous visitors may see (such as All work)
 * never trigger sign-in on their own, so the saved session would otherwise browse them signed out.
 */
export async function openSignedIn(page: Page, s: Settings, path: string) {
  const host = new URL(s.test_site).hostname;
  await page.goto(`https://id.atlassian.com/login?continue=${encodeURIComponent(s.test_site + path)}`);
  await page.waitForURL((u) => u.hostname === host, { timeout: 60_000, waitUntil: "commit" }).catch(() => {});
  if (new URL(page.url()).hostname !== host) throw new Blocked("Session expired: stopped at Atlassian sign-in");
}

/** All work (work item search) with a JQL query, shown in the JQL view. */
export async function openJqlSearch(page: Page, s: Settings, jql: string) {
  await openSignedIn(page, s, `/issues/?jql=${encodeURIComponent(jql)}`);
  // Wait for the result count or a JQL error (text matches can hit hidden copies, so use the count's own element)
  const count = page.locator('[data-testid="issue-navigator.ui.issue-results.list-view.issue-count.text"]');
  const error = page.getByText(/JQL error|does not exist/);
  await count.or(error).first().waitFor({ timeout: 60_000 });
  if (await error.first().isVisible()) throw new Error(`Search failed: ${(await error.first().innerText()).slice(0, 200)}`);
  await page.getByRole("button", { name: "JQL", exact: true }).or(page.getByRole("radio", { name: "JQL", exact: true })).first().click();
  await page.locator('[data-testid="jql-editor-input"]').waitFor();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Close pop-ups (e.g. feature tours); hiding them can leave the page dimmed
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible()) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}
