// Lesson:  AUC-1727 - Create search filters in Jira
//          https://community.atlassian.com/learning/lesson/create-jira-search-filters
// Image:   #3, section "Subscribe to a filter" (Filter Subscription dialog over a saved filter; arrow at Filter details)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/u0u6j4o41j2867432ky3ll2n1fr6m56b.png
// Recipe:  public.screenshot_recipes where asset_id = 'u0u6j4o41j2867432ky3ll2n1fr6m56b'
// Saved filter "High priority To Do items" (shared with a space; the test account has no starred filter like the
// lesson's), Filter details > Add subscription. The dialog is never submitted. The default time follows the clock
// and the results and recent sidebar items change, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { fakeNames } from "../lib/tweaks";
import { closeTours, jiraPeopleTweaks } from "../lib/b2-jira";
import { sidebarRecent, SUBSCRIBE_FILTER } from "../lib/b3-jsearch";

const details = (page: Page) => page.locator('[data-testid="custom-filters.ui.details-popup.button"]');
const addSub = (page: Page) => page.locator('[data-testid="custom-filters.ui.details-popup.popup-content.subscriptions.add-subscription-button"]');
const dialog = (page: Page) => page.locator('[role="dialog"]').filter({ hasText: "Filter Subscription" }).first();

runRecipe({
  file: "AUC-1727-3",
  assetId: "u0u6j4o41j2867432ky3ll2n1fr6m56b",
  title: "AUC-1727 #3 - Filter Subscription dialog",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, `/issues/?filter=${SUBSCRIBE_FILTER.id}`);
    await page.getByText(/^\d+ of \d+\+?$/).or(page.locator("table tbody tr")).first().waitFor({ timeout: 90_000 });
    const h1 = (await page.locator("h1").first().innerText()).split("\n")[0].trim();
    if (h1 !== SUBSCRIBE_FILTER.name) throw new Error(`Test data: filter ${SUBSCRIBE_FILTER.id} is now "${h1.slice(0, 60)}"`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await closeTours(page);
    await details(page).click();
    await addSub(page).click();
    await dialog(page).locator("#filter-subscription-recipients").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await fakeNames(page, "Employee");
  },

  mask: (page) => [
    page.locator("table tbody"),
    page.getByText(/^\d+ of \d+\+?$/),
    ...sidebarRecent(page),
    dialog(page).locator('select[name^="filter.subscription.prefix.runOnce"]'),
    dialog(page).getByText(/The timezone is the same as your profile/),
  ],

  async checks(page, c) {
    await c.check("Saved filter page: filter name, star and Filter details", async () => {
      const h1 = (await page.locator("h1").first().innerText()).split("\n")[0].trim();
      const d = await details(page).isVisible();
      const star = await page.getByRole("button", { name: /star/i }).first().isVisible().catch(() => false);
      return { pass: h1 === SUBSCRIBE_FILTER.name && d, detail: `"${h1}"; Filter details: ${d}; star: ${star}` };
    });

    await c.check("Filter Subscription dialog: Recipients (Personal Subscription)", async () => {
      const title = await dialog(page).getByText("Filter Subscription", { exact: true }).first().isVisible();
      const rec = await dialog(page).locator("#filter-subscription-recipients").evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? "");
      return { pass: title && rec === "Personal Subscription", detail: `Title: ${title}; recipients: "${rec}"` };
    });

    await c.check("Schedule: Daily (selected), Days per Week, Days per Month, Advanced", async () => {
      const text = await dialog(page).innerText();
      const missing = ["Daily", "Days per Week", "Days per Month", "Advanced"].filter((t) => !text.includes(t));
      const daily = await dialog(page).locator('[id="filter.subscription.prefix.daily-option"]').isChecked().catch(() => false);
      return { pass: !missing.length && daily, detail: `Missing: ${missing.join(", ") || "none"}; Daily selected: ${daily}` };
    });

    await c.check("Interval 'once per day' at hour, minutes, am/pm", async () => {
      const interval = await dialog(page).locator('[id="filter.subscription.prefix.interval"]').evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? "");
      const at = await dialog(page).locator('select[name^="filter.subscription.prefix.runOnce"]').count();
      return { pass: interval === "once per day" && at === 3, detail: `Interval: "${interval}"; time pickers: ${at}` };
    });

    await c.check("Email this filter even if no issues found; Subscribe and Cancel", async () => {
      const text = await dialog(page).innerText();
      const email = text.includes("Email this filter, even if there are no issues found");
      const sub = await dialog(page).locator("#filter-subscription-submit").isVisible();
      const cancel = await dialog(page).getByText("Cancel", { exact: true }).isVisible().catch(() => false);
      return { pass: email && sub && cancel, detail: `Email option: ${email}; Subscribe: ${sub}; Cancel: ${cancel}` };
    });
  },
});
