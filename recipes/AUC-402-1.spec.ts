// Lesson:  AUC-402 - Start navigating Confluence
//          https://community.atlassian.com/learning/lesson/explore-confluence-navigation
// Image:   #1, section "What is a space?"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0b18v84vsg8ue56c47b01tl63x25qlp5.png
// Recipe:  public.screenshot_recipes where asset_id = '0b18v84vsg8ue56c47b01tl63x25qlp5'

import { Page } from "@playwright/test";
import { Blocked, runRecipe } from "../lib/recipe";
import { Settings } from "../lib/supabase";
import { anonymize, hideMessages, renameOrg } from "../lib/tweaks";

// Any team space with a cover image and pages works; the lesson shows the Marketing space
const SPACE_KEY = "SyncUp";
const SPACE_NAME = "M0080 - SyncUp";
const DISPLAY_NAME = "Marketing";
const spaceSidebar = '[data-testid="app-navigation-space-container"]';
const treeItems = (page: Page) => page.locator(`${spaceSidebar} [data-testid="page-tree-item"]`);

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

/** The "who is viewing" avatar shows the test account's initials and name: make it neutral (display only). */
async function neutralPresence(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-testid^="team-presence-avatar"]').forEach((el) => {
      el.setAttribute("aria-label", "User A");
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/^[A-Z]{1,3}$/.test(n.nodeValue?.trim() ?? "")) n.nodeValue = "AU";
    });
    document.querySelectorAll("[aria-label*='(Viewing)']").forEach((el) => el.setAttribute("aria-label", "User A (Viewing)"));
  });
}

runRecipe({
  file: "AUC-402-1",
  assetId: "0b18v84vsg8ue56c47b01tl63x25qlp5",
  title: "AUC-402 #1 - A space with content in the sidebar",
  product: "confluence",

  navigate: (page, s) => openSpace(page, s, SPACE_KEY),

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await neutralPresence(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    // The lesson's space is called Marketing (display only)
    await renameOrg(page, SPACE_NAME, DISPLAY_NAME);
    // Comments, details and Rovo buttons on the right edge; the lesson doesn't show them
    await page.locator('[data-testid="object-sidebar-container"]').evaluate((el) => (el.style.visibility = "hidden")).catch(() => {});
  },

  // The lesson image is 700px tall
  clip: { x: 0, y: 0, width: 1280, height: 700 },

  // Page titles in the tree and the overview page body are site data
  mask: (page) => [treeItems(page), page.locator(".ak-renderer-document")],

  async checks(page, c) {
    await c.check("Global sidebar: For you, Recent, Starred, Spaces, Apps, Teams", async () => {
      const missing = [];
      for (const t of ["For you", "Recent", "Starred", "Spaces", "Apps", "Teams"])
        if (!(await page.getByRole("link", { name: t, exact: true }).or(page.getByRole("button", { name: t, exact: true })).first().isVisible())) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Space sidebar: the space name, then Shortcuts, then Content with a 'Search by title' box", async () => {
      const name = await page.locator(`${spaceSidebar} a`).first().boundingBox();
      const shortcuts = await page.locator(spaceSidebar).getByRole("button", { name: "Shortcuts", exact: true }).boundingBox();
      const content = await page.locator(spaceSidebar).getByRole("button", { name: "Content", exact: true }).boundingBox();
      const search = await page.locator(spaceSidebar).getByPlaceholder("Search by title").boundingBox();
      const pass = !!name && !!shortcuts && !!content && !!search && name.y < shortcuts.y && shortcuts.y < content.y && content.y < search.y;
      const missing = Object.entries({ "space name": name, Shortcuts: shortcuts, Content: content, "Search by title": search }).filter(([, b]) => !b).map(([k]) => k);
      return { pass, detail: missing.length ? `Missing: ${missing.join(", ")}` : pass ? "Present, in this order" : "All present, different order" };
    });

    await c.check("Test data: the Content tree lists several items (the lesson shows about 10, including a folder and a database)", async () => {
      const n = await treeItems(page).count();
      return { pass: n >= 8, detail: `${n} top-level items in the tree` };
    });

    await c.check("Space overview: cover image, space icon and the space name as the title", async () => {
      const h1 = (await page.locator("h1").first().innerText().catch(() => "")).trim();
      const imgs = await page.locator("#AkMainContent img").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 50).length);
      const pass = h1 === DISPLAY_NAME && imgs > 0;
      return { pass, detail: `Title "${h1}", ${imgs} large images (cover/icon)` };
    });

    await c.check("Page header: breadcrumb with the space name, Share, and 'Star this space'", async () => {
      const crumb = await page.locator('[data-testid="breadcrumbs-dropdown-chevron-button"]').or(page.getByRole("navigation", { name: /breadcrumb/i })).first().innerText().catch(() => "");
      const share = await page.locator('[data-testid="controlled-share-button"]').isVisible();
      const star = await page.getByRole("button", { name: /Star this space/i }).first().isVisible();
      const pass = crumb.includes(DISPLAY_NAME) && share && star;
      return { pass, detail: `Breadcrumb ${crumb.includes(DISPLAY_NAME) ? "present" : "missing"}, Share ${share ? "present" : "missing"}, Star this space ${star ? "present" : "missing"}` };
    });
  },
});
