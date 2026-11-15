// Lesson:  AUC-402 - Start navigating Confluence
//          https://community.atlassian.com/learning/lesson/explore-confluence-navigation
// Image:   #7, section "How do you find content within a space?"
//          (base image of the labelled graphic "0050-Confluence space sidebar")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/cni4r07255187q66p2uj42ebsv42o067.png
// Recipe:  public.screenshot_recipes where asset_id = 'cni4r07255187q66p2uj42ebsv42o067'

import { Locator, Page } from "@playwright/test";
import { Blocked, runRecipe } from "../lib/recipe";
import { Settings } from "../lib/supabase";
import { mainContent, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, spotlight } from "../lib/tweaks";

// Any team space with pages, a blog and one calendar works; the lesson shows the Marketing space
const SPACE_KEY = "SyncUp";
const sidebar = 'nav[aria-label="Sidebar"]';
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

/** Top-level sidebar items in page order (not page tree items or small icon buttons), without "(opens new window)". */
async function sidebarLabels(page: Page) {
  return page.locator(sidebar).evaluate((nav) =>
    Array.from(nav.querySelectorAll<HTMLElement>("a, button"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 150 && r.height > 0 && !el.closest('[data-testid="page-tree-container"], [data-testid="tree-container-flex"]');
      })
      .map((el) => el.innerText.split("\n")[0].replace(/,?\s*\(opens new window\)/i, "").trim())
      .filter((t) => t && !["Create", "Back to top"].includes(t) && !t.startsWith("Import")),
  );
}

/** Visible sidebar link or button by its label (links to other apps add ", (opens new window)"). */
const item = (page: Page, label: string): Locator => {
  const name = new RegExp(`^${label}(\\s*,.*)?$`);
  return page.locator(sidebar).getByRole("link", { name }).or(page.locator(sidebar).getByRole("button", { name })).locator("visible=true").first();
};

// Items with a hotspot in the lesson, top to bottom
const hotspotLabels = ["For you", "Recent", "Spaces", "Apps", "Teams", "More", "Content", "Blogs", "Calendars"];

runRecipe({
  file: "AUC-402-7",
  assetId: "cni4r07255187q66p2uj42ebsv42o067",
  title: "AUC-402 #7 - Confluence space sidebar",
  product: "confluence",

  navigate: (page, s) => openSpace(page, s, SPACE_KEY),

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    // The lesson shows the Content section collapsed: hide the page tree and its search box (display only,
    // so the sidebar state saved for the account does not change)
    await page.locator('[data-testid="pageTree"]').evaluate((tree) => {
      const header = tree.querySelector("button");
      let el = tree.querySelector<HTMLElement>('[data-testid="page-tree-container"]');
      while (el && el.parentElement && el.parentElement !== tree && !el.parentElement.contains(header)) el = el.parentElement;
      if (el && !el.contains(header)) el.style.display = "none";
    });
    // Page comment and details buttons, the floating Rovo button and the unread count: not in the lesson
    await page.locator('[data-testid="object-sidebar-container"], [data-testid="platform-ai-button"]').evaluateAll((els) =>
      els.forEach((el) => ((el as HTMLElement).style.visibility = "hidden")),
    );
    await hideNotificationCount(page);
    await page.waitForTimeout(500);
    const visible: Locator[] = [];
    for (const t of hotspotLabels) {
      const l = item(page, t);
      const box = await l.boundingBox().catch(() => null);
      if (box && box.y + box.height <= 800) visible.push(l);
    }
    const space = page.locator(`${spaceSidebar} [data-testid="hover-preloader"]`).first();
    // Outline from For you down to the last visible item; markers on the lesson's hotspots plus the space name
    await spotlight(page, [item(page, "For you"), ...visible, space].reduce((a, b) => a.or(b)), {
      markersOn: [...visible, space].reduce((a, b) => a.or(b)),
      lineLengths: [160, 260],
    });
  },

  // Space content is dimmed background
  mask: (page) => [page.locator(mainContent)],

  async checks(page, c) {
    const labels = await sidebarLabels(page);
    const spaceName = (await page.locator(`${spaceSidebar} [data-testid="hover-preloader"]`).first().innerText().catch(() => "")).split("\n")[0].trim();

    await c.check("Sidebar starts with: For you, Recent, Starred, Spaces, Apps", async () =>
      sameOrder(labels.slice(0, 5), ["For you", "Recent", "Starred", "Spaces", "Apps"]),
    );

    await c.check("After Apps and above the space: Teams, Company hub, More", async () => {
      const at = labels.indexOf(spaceName);
      const r = sameOrder(at > 5 ? labels.slice(5, at) : [], ["Teams", "Company hub", "More"]);
      return r.pass ? r : { pass: false, detail: `${r.detail} Sidebar order now: ${labels.join(", ")}` };
    });

    await c.check("Space section: space name, then Shortcuts, Content, Blogs, Calendars", async () => {
      const at = labels.indexOf(spaceName);
      return sameOrder(at >= 0 ? labels.slice(at + 1, at + 5) : [], ["Shortcuts", "Content", "Blogs", "Calendars"]);
    });

    await c.check("Space name has a More actions (...) button", async () => {
      const visible = await page.locator(spaceSidebar).getByRole("button", { name: "More actions" }).first().isVisible();
      return { pass: visible, detail: visible ? "Present" : "Not found" };
    });

    await c.check("Sidebar ends with 'Give feedback on the new navigation'", async () => {
      const visible = await page.locator(sidebar).getByText("Give feedback on the new navigation").first().isVisible().catch(() => false);
      return { pass: visible, detail: visible ? "Present" : `Not found. Sidebar now ends with: ${labels.slice(-4).join(", ")}` };
    });

    await c.check("Test data: the space has one Calendars link", async () => {
      const n = labels.filter((t) => t === "Calendars").length;
      return { pass: n === 1, detail: `${n} Calendars link(s) in space ${SPACE_KEY}` };
    });
  },
});
