// Lesson:  AUC-426 - Organize your work in Jira Service Management
//          https://community.atlassian.com/learning/lesson/how-to-organize-work-in-jira-service-management
// Image:   #5, section "Monitor due dates on your calendar" (IT Operations Views page, Calendar tab: month grid with work items on their due dates, filters, Today and month picker)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/qp168d8423u0u0uqy07077mqg428mcp3
// Recipe:  public.screenshot_recipes where asset_id = 'qp168d8423u0u0uqy07077mqg428mcp3'
// Test site: the ITS space has no "Views" page any more; a calendar is now a view tab a queue can add ("+" next to
// List). Adding one changes the queue, so the recipe opens the ITS "All open tickets" queue and the "+" menu only, and
// reports what is offered. ITS due dates are in 2025 only (test data).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const addView = (page: Page) => page.locator('[data-testid="navigation-kit-add-tab.ui.trigger"]').first();
const menuOpen = (page: Page) => page.getByRole("menu").or(page.getByRole("listbox")).or(page.getByRole("dialog")).first();

runRecipe({
  file: "AUC-426-5",
  assetId: "qp168d8423u0u0uqy07077mqg428mcp3",
  title: "AUC-426 #5 - Calendar view of a space",
  product: "jira",

  async navigate(page, s) {
    await openItsQueue(page, s);
    await addView(page).click();
    await menuOpen(page).waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  tweak: (page, s) => jsmTweaks(page, s),
  mask: queueMask,

  async checks(page, c) {
    await c.check("Space sidebar item 'Views' with Board and Calendar tabs", async () => {
      const v = await sidebarItem(page, /^Views/).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "UI change: no Views item in the space sidebar; queues have view tabs (List, +) instead" };
    });
    await c.check("A Calendar view can be added from the queue's '+' menu", async () => {
      const text = await textOf(menuOpen(page));
      const cal = /Calendar/.test(text);
      return { pass: false, detail: cal ? `Calendar offered in the '+' menu ("${text.replace(/\s+/g, " ").slice(0, 100)}"); not added (it would change the queue)` : `Menu: "${text.replace(/\s+/g, " ").slice(0, 100)}"` };
    });
    await c.check("Calendar month grid with work items on their due dates", async () => ({ pass: false, detail: "Needs test data: no calendar view on the ITS queues, and ITS due dates are all in 2025" }));
  },
});
