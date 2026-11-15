// Lesson:  AUC-402 - Start navigating Confluence
//          https://community.atlassian.com/learning/lesson/explore-confluence-navigation
// Image:   #4, section "Find spaces within Confluence"
//          (base image of the labelled graphic "0050-Navigation bar")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/q25dqacc1i0j15nka2xyf485371b087m.png
// Recipe:  public.screenshot_recipes where asset_id = 'q25dqacc1i0j15nka2xyf485371b087m'

import { Locator, Page } from "@playwright/test";
import { Blocked, runRecipe } from "../lib/recipe";
import { Settings } from "../lib/supabase";
import { mainContent } from "../lib/confluence";
import { anonymize, hideMessages, markers, spotlight } from "../lib/tweaks";

// Any team space with a cover image works; the lesson shows the Marketing space
const SPACE_KEY = "SyncUp";
const spaceSidebar = '[data-testid="app-navigation-space-container"]';

/** Opens a space overview, waiting for the space sidebar (same pattern as lib/confluence.ts). */
async function openSpace(page: Page, s: Settings, key: string) {
  await page.goto(`${s.test_site}/wiki/spaces/${key}/overview`, { waitUntil: "commit" });
  const ready = page.locator(spaceSidebar);
  await ready.waitFor({ timeout: 60_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (!(await ready.isVisible())) {
    const missing = await page.getByText(/can't find|doesn't exist|don't have (permission|access)/i).first().isVisible().catch(() => false);
    if (missing) throw new Blocked(`Test data: the test account cannot open space ${key}`);
    throw new Error(`Space ${key} did not load`);
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible()) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
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

// Top bar items, left to right, as in the lesson (the Rovo button is checked on its own)
const topBar = (page: Page) => page.locator("header").first();
const topItems = (page: Page): [string, Locator][] => [
  ["Sidebar toggle", topBar(page).getByRole("button", { name: /^(Collapse|Expand) sidebar$/ })],
  ["App switcher", topBar(page).getByRole("button", { name: "Switch sites or apps", exact: true })],
  ["Confluence logo", topBar(page).getByRole("link", { name: "Confluence", exact: true })],
  ["Search", topBar(page).locator('[data-testid="search-input-container"]')],
  ["Create", topBar(page).locator('[data-testid="create-content-popover-button"]')],
  ["Rovo", topBar(page).getByRole("button", { name: /Rovo/ })],
  ["Notifications", topBar(page).locator('[data-testid="top-nav-notifications-button"]')],
  ["Help", topBar(page).getByRole("button", { name: "Help", exact: true })],
  ["Confluence administration", topBar(page).getByRole("button", { name: "Confluence administration", exact: true })],
  ["Profile", topBar(page).locator('[data-testid="confluence-account-menu--trigger"]')],
];
// Items with a hotspot in the lesson (not the logo or Notifications)
const hotspotNames = ["Sidebar toggle", "App switcher", "Search", "Create", "Rovo", "Help", "Confluence administration", "Profile"];

runRecipe({
  file: "AUC-402-4",
  assetId: "q25dqacc1i0j15nka2xyf485371b087m",
  title: "AUC-402 #4 - Confluence main navigation bar",
  product: "confluence",

  navigate: (page, s) => openSpace(page, s, SPACE_KEY),

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await hideNotificationCount(page);
    // Outline from the sidebar toggle to the profile picture (the whole bar, inset as in the lesson)
    await spotlight(page, topItems(page).map(([, l]) => l.first()).reduce((a, b) => a.or(b)), { markers: false });
    const hot = topItems(page).filter(([n]) => hotspotNames.includes(n)).map(([, l]) => l.first());
    await markers(page, hot.reduce((a, b) => a.or(b)), "down", [110, 190]);
  },

  // The lesson image shows the top of the page; the space content is dimmed background
  clip: { x: 0, y: 0, width: 1280, height: 550 },

  // Space content, page tree and notification count depend on site data
  mask: (page) => [page.locator(mainContent), page.locator(spaceSidebar), page.locator('[data-testid="top-nav-notifications-button"]')],

  async checks(page, c) {
    await c.check(
      "Top bar, left to right: sidebar toggle, app switcher, Confluence logo, Search, Create, Rovo, Notifications, Help, Confluence administration (settings), Profile",
      async () => {
        const found: { name: string; x: number }[] = [];
        const missing: string[] = [];
        for (const [name, l] of topItems(page)) {
          const box = await l.first().boundingBox();
          if (box && box.y < 48) found.push({ name, x: box.x });
          else missing.push(name);
        }
        const order = [...found].sort((a, b) => a.x - b.x).map((f) => f.name);
        const pass = !missing.length && JSON.stringify(order) === JSON.stringify(found.map((f) => f.name));
        return { pass, detail: pass ? "All present, same order" : `Missing: ${missing.join(", ") || "none"}. Order now: ${order.join(", ")}` };
      },
    );

    await c.check("Rovo button reads 'Rovo Chat'", async () => {
      const text = (await topItems(page)[5][1].first().innerText().catch(() => "")).trim();
      return { pass: text === "Rovo Chat", detail: text ? `"${text}"` : "Not found" };
    });

    await c.check("Search is a wide box between the logo and Create", async () => {
      const search = await topBar(page).locator('[data-testid="search-input-container"]').boundingBox();
      const pass = !!search && search.width > 300;
      return { pass, detail: search ? `Width ${Math.round(search.width)}px` : "Not found" };
    });
  },
});
