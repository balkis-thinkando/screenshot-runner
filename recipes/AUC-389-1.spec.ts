// Lesson:  AUC-389 - Adjust your personal settings in Jira
//          https://community.atlassian.com/learning/lesson/adjust-your-jira-personal-settings
// Image:   #1, section "Explore your personal settings" (the top bar Settings button and its open menu are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/76o3145htelin2rkrcslsal58h54q751
// Recipe:  public.screenshot_recipes where asset_id = '76o3145htelin2rkrcslsal58h54q751'
// Opens the Spaces directory and clicks the top bar Settings (gear) button; nothing in the menu is clicked.
// Space leads are shown with fake names (profile cards).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { basicTweaks, missingFrom, openPage } from "../lib/b3-jreports";

const GEAR = '[data-testid="atlassian-navigation--secondary-actions--settings--menu-trigger"]';
const MENU_ID = "atlassian-navigation--secondary-actions--settings--menu-popup";
const MENU = `[data-testid="${MENU_ID}"]`;
const titles = (page: Page, section: string) =>
  page.locator(`[data-testid^="${MENU_ID}--${section}--item-"][data-testid$="--primitive--title"]`).allInnerTexts();

runRecipe({
  file: "AUC-389-1",
  assetId: "76o3145htelin2rkrcslsal58h54q751",
  title: "AUC-389 #1 - Settings menu over the Spaces directory",
  product: "jira",

  async navigate(page, s) {
    await openPage(page, s, "/jira/projects", (p) => p.getByRole("heading", { name: "Spaces", exact: true }), "Spaces directory");
    await page.locator("table tbody tr").nth(5).waitFor({ timeout: 60_000 });
    await page.locator(GEAR).click();
    await page.locator(MENU).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    await spotlightAreas(page, [page.locator(GEAR), page.locator(MENU)]);
  },

  async checks(page, c) {
    await c.check("Spaces directory behind the menu (title, search, Filter by app, table)", async () => {
      const h = await page.getByRole("heading", { name: "Spaces", exact: true }).isVisible();
      const search = await page.getByPlaceholder("Search spaces").isVisible().catch(() => false);
      const rows = await page.locator('[data-testid="page-layout.main"] table tbody tr').count();
      return { pass: h && search && rows > 5, detail: `Title: ${h}; search box: ${search}; rows: ${rows}` };
    });

    await c.check("Menu section 'Personal Jira settings' with General settings and Notification settings", async () => {
      const head = (await page.locator(`[data-testid="${MENU_ID}--personal-settings--heading"]`).innerText().catch(() => "")).trim();
      const items = await titles(page, "personal-settings");
      const missing = missingFrom(items, ["General settings", "Notification settings"]);
      return { pass: head === "Personal Jira settings" && !missing.length, detail: `Heading: "${head}"; items: ${items.join(", ")}` };
    });

    await c.check("Item descriptions: 'Manage language, time zone, ...' and 'Manage email and in-app notifications ...'", async () => {
      const text = await page.locator(MENU).innerText();
      const ok = /Manage language, time zone/.test(text) && /Manage email and in-app notifications/.test(text);
      return { pass: ok, detail: ok ? "Present" : "UI change: the descriptions differ" };
    });

    await c.check("Menu section 'Jira admin settings': System, Jira apps, Spaces, Work items, Marketplace apps", async () => {
      const items = await titles(page, "system-admin");
      const missing = missingFrom(items, ["System", "Jira apps", "Spaces", "Work items", "Marketplace apps"]);
      const extra = items.filter((i) => !["System", "Jira apps", "Spaces", "Work items", "Marketplace apps"].includes(i));
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}${extra.length ? ` (not in the lesson: ${extra.join(", ")})` : ""}` };
    });

    await c.check("Menu section 'Atlassian admin settings': User management, Billing", async () => {
      const items = await titles(page, "site-admin");
      const missing = missingFrom(items, ["User management", "Billing"]);
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}` };
    });

    await c.check("Search (Cmd + K) button in the menu header", async () => {
      const ok = await page.locator(MENU).getByText(/^Search/).first().isVisible().catch(() => false);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });
  },
});
