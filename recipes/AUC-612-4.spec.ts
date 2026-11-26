// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #4, section "Create application links" (app switcher menu open over the MOBL Cowboys board of Mobile
//          Dev; the switcher button and the menu are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/mgw16tlysyig7507d51k168m1qj44f4h
// Recipe:  public.screenshot_recipes where asset_id = 'mgw16tlysyig7507d51k168m1qj44f4h'
// Opens the MOBL Cowboys board (id 2, the lesson's board) of Mobile Dev and clicks "Switch apps and sites" in the top
// bar. Read only. Which apps are listed depends on the site's subscriptions, so only the core ones are checked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { openSignedIn } from "../lib/jira";
import { closeTours } from "../lib/b2-jira";
import { failOnReauth, jadminTweaks } from "../lib/b3-jadmin";

// Apps every site of the training org has; the lesson's others (Loom, Focus, Talent, Jira Product Discovery, Compass,
// Bitbucket) depend on the site's subscriptions
const CORE_APPS = ["Jira", "Confluence", "Jira Service Management", "Assets"];
const switcher = (page: Page) => page.getByRole("button", { name: "Switch apps and sites" }).first();
/** The open switcher popup: the outermost layer holding both the Jira and the Confluence items. */
const menu = (page: Page) =>
  page
    .locator('[role=dialog], [role=menu], [data-testid*="app-switcher"], [data-testid*="switcher"]')
    .filter({ has: page.getByText("Confluence", { exact: true }) })
    .filter({ has: page.getByText("Jira Service Management", { exact: true }) })
    .first();

runRecipe({
  file: "AUC-612-4",
  assetId: "mgw16tlysyig7507d51k168m1qj44f4h",
  title: "AUC-612 #4 - App switcher menu",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/software/c/projects/MOBL/boards/2");
    await page.getByText(/Mobile Dev/).first().waitFor({ timeout: 90_000 });
    await failOnReauth(page);
    await page.locator('[data-testid*="board"], [data-test-id*="board"]').first().waitFor({ timeout: 60_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await closeTours(page);
    await switcher(page).click();
    await menu(page).getByText("Confluence", { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    // The site row's initials come from the real site name; show the display org's
    await menu(page).evaluate((el, org) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode())
        if (/^[A-Z][a-z]$/.test((n.nodeValue ?? "").trim())) { n.nodeValue = org.slice(0, 2); break; }
    }, s.display_org_name);
    await spotlightAreas(page, [switcher(page), menu(page)]);
  },

  // Board cards and avatars behind the menu change with the board's data
  mask: (page) => [page.locator("main, [role=main]").first()],

  async checks(page, c, s) {
    await c.check("Board of the Mobile Dev space behind the menu", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Mobile Dev") && /Backlog|Active sprints|Board/.test(t);
      return { pass: ok, detail: ok ? "Present" : "Board not shown" };
    });

    await c.check("App switcher menu open from the 'Switch apps and sites' button", async () => {
      const open = await menu(page).isVisible().catch(() => false);
      return { pass: open, detail: open ? "Open" : "Not open" };
    });

    await c.check("Site switcher (site name with a dropdown) at the top of the menu", async () => {
      const lines = (await menu(page).innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
      const site = lines.slice(0, 3).includes(s.display_org_name);
      return { pass: site, detail: `First lines: ${lines.slice(0, 3).join(" / ").slice(0, 60)}` };
    });

    await c.check("First item 'Home', then Jira, Confluence, Jira Service Management, Assets", async () => {
      const items = (await menu(page).innerText()).split("\n").map((l) => l.trim());
      const missing = CORE_APPS.filter((a) => !items.includes(a));
      const home = items.includes("Home");
      const rovoHome = items.includes("Rovo Home");
      return {
        pass: home && !missing.length,
        detail: `${home ? "Home: present" : rovoHome ? "UI change: 'Home' is now 'Rovo Home'" : "Home: missing"}${missing.length ? `; missing: ${missing.join(", ")}` : ""}`,
      };
    });
  },
});
