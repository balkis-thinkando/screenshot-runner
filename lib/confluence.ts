import { Locator, Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Shared navigation for Confluence recipes on the test site ({test_site}/wiki).

export const adminNav = '[data-testid="app-navigation-admin-container"]';
export const mainContent = "#AkMainContent";
export const adminButton = (page: Page) => page.getByRole("button", { name: "Confluence administration", exact: true });

async function open(page: Page, url: string, ready: Locator, what: string) {
  await page.goto(url);
  await ready.waitFor({ timeout: 30_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (!(await ready.isVisible())) {
    const denied = await page.getByText(/don't have (permission|access)|not authorized/i).first().isVisible().catch(() => false);
    if (denied) throw new Blocked(`The test account cannot open ${what}`);
    throw new Error(`${what} did not load`);
  }
  // Let late panels and pop-ups render, then close pop-ups (hiding them can leave the page dimmed)
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible()) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

/** Confluence home ("For you"). */
export async function openConfluenceHome(page: Page, s: Settings) {
  await open(page, `${s.test_site}/wiki/home`, adminButton(page), "Confluence home");
}

/** Confluence administration, Mission control page. */
export async function openConfluenceAdmin(page: Page, s: Settings) {
  await open(page, `${s.test_site}/wiki/admin/center`, page.locator(`${adminNav} a[data-testid="admin-center"]`), "Confluence administration");
  await page.locator("h1", { hasText: "Mission control" }).waitFor();
}

/** Sidebar headings and links of Confluence administration, in page order, without badges. */
export async function adminNavLabels(page: Page) {
  const texts = await page.locator(`${adminNav} [id$="-heading"], ${adminNav} a, ${adminNav} button`).allInnerTexts();
  return texts
    .map((t) => t.replace(/,?\s*\(opens new window\)/i, "").replace(/\s*New\s*$/, "").trim())
    .filter((t) => t && t !== "Go back");
}

/** Compares a list of labels with the expected order; returns a check result. */
export function sameOrder(actual: string[], expected: string[]) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  const added = actual.filter((t) => !expected.includes(t));
  const removed = expected.filter((t) => !actual.includes(t));
  return {
    pass: same,
    detail: same ? "Same items, same order" : `Now: ${actual.join(", ")}. Added: ${added.join(", ") || "none"}. Removed or renamed: ${removed.join(", ") || "none"}.`,
  };
}
