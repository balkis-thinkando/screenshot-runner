// Lesson:  AUC-384 - Collaborate on work items in Jira
//          https://community.atlassian.com/learning/lesson/collaborate-on-work-items-in-jira
// Image:   #3, section "Watch work items" (the watchers button and its open menu are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT129H.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT129H'
// Opens the lesson's work item (EO-2, "New-hire first engagement") over the Employee Onboarding board and clicks the
// watchers (eye) button. Start watching is not clicked. The watcher is shown with a fake name.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { AUC383_SUMMARY, AUC383_WORK_ITEM, jiraPeopleTweaks } from "../lib/b2-jira";
import { EO_BOARD, fakeListedPeople, hidePromos, openItemOnBoard, WATCHERS_BUTTON } from "../lib/b3-jreports";

const MENU = '[data-testid="issue.watchers.dropdown.dropdown"]';

runRecipe({
  file: "AUC-384-3",
  assetId: "AT129H",
  title: "AUC-384 #3 - Watchers menu",
  product: "jira",

  async navigate(page, s) {
    await openItemOnBoard(page, s, EO_BOARD, AUC383_WORK_ITEM, AUC383_SUMMARY);
    await page.locator(`${WATCHERS_BUTTON}:visible`).first().click();
    await page.locator(MENU).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeListedPeople(page.locator(MENU), ["Grace Kim"]);
    await jiraPeopleTweaks(page, s);
    await hidePromos(page);
    await spotlightAreas(page, [[page.locator(`${WATCHERS_BUTTON}:visible`).first(), page.locator(MENU)]]);
  },

  mask: (page) => [page.locator('[data-testid="issue-activity-feed.heading"]').locator("xpath=..")],

  async checks(page, c) {
    await c.check("Watchers button with the watcher count", async () => {
      const n = (await page.locator('[data-testid="issue.watchers.action-button.counter"]:visible').first().innerText().catch(() => "")).trim();
      return { pass: /^\d+$/.test(n), detail: `Count: "${n}" (lesson: 1)` };
    });

    await c.check("Menu lists the current watcher", async () => {
      const n = await page.locator(`${MENU} [data-testid^="issue.watchers.dropdown.user-item."][data-testid$="--primitive--title"]`).count();
      return { pass: n >= 1, detail: `Watchers listed: ${n}` };
    });

    await c.check("'Start watching' item with the W shortcut", async () => {
      const t = (await page.locator('[data-testid="issue-view-watchers.watchers.dropdown.change-watch-state.watch-toggle"]').innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      return { pass: /^(Start|Stop) watching/.test(t) && /\bw\b/i.test(t), detail: `Item: "${t}"` };
    });

    await c.check("'Add watchers' item", async () => {
      const ok = await page.locator(MENU).getByText("Add watchers", { exact: true }).first().isVisible().catch(() => false);
      const heading = (await page.locator(MENU).getByText(/^Watching this/).first().innerText().catch(() => "")).trim();
      return {
        pass: ok,
        detail: ok ? "Present" : `Missing (the test account may lack the Manage watchers permission)${heading ? `; the menu has a '${heading}' heading above the list` : ""}`,
      };
    });
  },
});
