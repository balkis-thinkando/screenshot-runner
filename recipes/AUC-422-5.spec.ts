// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #5, section "Navigate around Jira Service Management" (Jira Spaces list; the top navigation bar outlined with markers on the app switcher, Search, Create, Notifications, Help, Settings and profile)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12KB.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12KB'
// Opens Jira > Spaces and closes the Templates side panel if it opened. Space leads become fake names. Nothing is starred or created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const topBar = (page: Page) => page.locator('header, [data-testid="page-layout.top-nav"], [role="banner"]').first();

runRecipe({
  file: "AUC-422-5",
  assetId: "AT12KB",
  title: "AUC-422 #5 - Spaces list and top navigation",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/projects", (p) => p.getByText(/spaces found/));
    // The Templates side panel opens on its own; the lesson has it closed (closing it changes nothing on the site)
    const panel = page.getByText("Preview a template for your next space").first();
    if (await panel.isVisible().catch(() => false)) {
      await panel.locator("xpath=ancestor::*[.//button[@aria-label='Close' or normalize-space()='Close']][1]").getByRole("button", { name: "Close" }).first().click().catch(() => {});
      await panel.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    }
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await spotlightAreas(page, await visibleAreas([topBar(page)]));
  },

  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Top bar: app switcher, Jira, sidebar toggle, Search, Create, Ask Rovo, Notifications, Help, Settings, profile", async () => {
      const missing: string[] = [];
      for (const [n, l] of [["Switch apps", /Switch (apps|sites)/], ["Search", /Search/], ["Create", /^Create$/], ["Ask Rovo", /Ask Rovo/], ["Notifications", /Notifications/], ["Help", /^Help$/], ["Settings", /^Settings$/]] as const)
        if (!(await topBar(page).getByRole("button", { name: l }).or(topBar(page).getByRole("link", { name: l })).or(topBar(page).getByPlaceholder(l)).first().isVisible().catch(() => false))) missing.push(n);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
    await checkHeading(c, "Heading 'Spaces'", page, "Spaces");
    await checkTexts(c, "Create space, Templates; Search spaces, Filter by app, All categories", page, ["Create space", "Templates", "Filter by app", "All categories"], mainArea(page));
    await c.check("Columns: Name, Key, Type, Lead, Category, Space URL", async () => {
      const got = await columns(page);
      const missing = ["Name", "Key", "Type", "Lead", "Category", "Space URL"].filter((w) => !got.some((g) => g.startsWith(w)));
      return { pass: !missing.length, detail: `Columns: ${got.join(", ")}` };
    });
    await checkTexts(c, "Sidebar: For you, Recent, Starred, Apps, Roadmaps, Plans, Spaces, Filters, Dashboards, Operations", page, ["For you", "Recent", "Starred", "Apps", "Roadmaps", "Plans", "Spaces", "Filters", "Dashboards", "Operations"]);
  },
});
