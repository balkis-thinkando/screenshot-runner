import { Locator, Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Shared navigation for Confluence recipes on the test site ({test_site}/wiki).

export const adminNav = '[data-testid="app-navigation-admin-container"]';
export const mainContent = "#AkMainContent";
export const adminButton = (page: Page) => page.getByRole("button", { name: "Confluence administration", exact: true });

async function open(page: Page, url: string, ready: Locator, what: string) {
  await page.goto(url, { waitUntil: "commit" });
  await ready.waitFor({ timeout: 60_000 }).catch(() => {});
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

/** For lessons that show a page with the sidebar collapsed: hides it display-only (the real collapse is a saved preference). */
export async function hideSidebar(page: Page) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#side-navigation")!.style.display = "none";
    // The layout grid keeps a fixed sidebar column; give its width to the main column
    document.querySelector<HTMLElement>("#unsafe-design-system-page-layout-root")!.style.gridTemplateColumns = `0px 0px ${innerWidth}px 0px`;
  });
  await page.waitForTimeout(1_500); // let the page reflow to its wide layout
}

/** A page of the test site by space key and page ID, ready once its title shows. */
export async function openConfluencePage(page: Page, s: Settings, space: string, pageId: string) {
  // Through Atlassian sign-in: a page opened directly can stop at the sign-in screen
  const url = `${s.test_site}/wiki/spaces/${space}/pages/${pageId}`;
  await open(page, `https://id.atlassian.com/login?continue=${encodeURIComponent(url)}`, page.locator('[data-testid="title-text"], h1').first(), `Confluence page ${pageId}`);
}

/** The page used for Rovo shots: a long SyncUp page with text, an info panel and a table (no people pictured). */
export const ROVO_PAGE = { space: "SyncUp", id: "2130015", title: "Engineering onboarding guide" };
