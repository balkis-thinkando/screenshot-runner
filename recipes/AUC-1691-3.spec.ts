// Lesson:  AUC-1691 - Use a scrum board in Jira
//          https://community.atlassian.com/learning/lesson/how-to-use-jira-scrum-board
// Image:   #3, section "View sprint dates" (Active sprints board; the sprint icon next to Complete sprint is clicked
//          and outlined, with its popup: sprint name, days left, start and end dates)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/g2o8ob03diyquov8351xwxnm0nuo2ku2.png
// Recipe:  public.screenshot_recipes where asset_id = 'g2o8ob03diyquov8351xwxnm0nuo2ku2'
// Opens TH board (M0004 - Team Horizon), which has an active sprint, and clicks the Sprint details button. Days left
// and dates change with the sprint, so they are masked. Stand-in for the lesson's AP board.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { boardHeaderChecks, boardTweaks, openBoard, recentSpaces, SCRUM, sprintDetailsButton } from "../lib/b3-jboards";

/** The popup under the Sprint details button: the innermost box with the dates. */
const popup = (page: Page) =>
  page.locator("div").filter({ hasText: "Start date" }).filter({ hasText: "End date" }).filter({ hasText: /left/ }).last();

runRecipe({
  file: "AUC-1691-3",
  assetId: "g2o8ob03diyquov8351xwxnm0nuo2ku2",
  title: "AUC-1691 #3 - Sprint dates popup",
  product: "jira",

  async navigate(page, s) {
    await openBoard(page, s, SCRUM);
    await sprintDetailsButton(page).click();
    await page.getByText("Start date", { exact: true }).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
    // Outline the popup's own box (the nearest box with a shadow around the dates), not just its text
    await popup(page).evaluate((el) => {
      let box: HTMLElement | null = el as HTMLElement;
      while (box && box !== document.body && getComputedStyle(box).boxShadow === "none") box = box.parentElement;
      (box && box !== document.body ? box : (el as HTMLElement)).setAttribute("data-jb-popup", "");
    });
    await spotlightAreas(page, [sprintDetailsButton(page), page.locator("[data-jb-popup]")]);
  },

  mask: (page) => [recentSpaces(page), popup(page), page.locator('[data-testid="platform-board-kit.ui.card.card"]')],

  async checks(page, c) {
    await c.check("Sprint details popup open from the icon next to Complete sprint", async () => {
      const open = await popup(page).isVisible().catch(() => false);
      const label = await sprintDetailsButton(page).getAttribute("aria-label").catch(() => null);
      const text = (await popup(page).innerText().catch(() => "")).replace(/\s+/g, " ");
      return { pass: open, detail: `Popup: ${open}; button: "${label ?? (await sprintDetailsButton(page).innerText().catch(() => ""))}"; text: ${text.slice(0, 100)}` };
    });

    await c.check("Popup shows the sprint name, days left, Start date and End date", async () => {
      const text = await popup(page).innerText().catch(() => "");
      const name = /Sprint/.test(text);
      const left = /\d+ days? left/.test(text);
      const dates = /Start date/.test(text) && /End date/.test(text) && (text.match(/\b20\d\d\b/g) ?? []).length >= 2;
      return { pass: name && left && dates, detail: `Name: ${name}; days left: ${left}; start and end dates: ${dates}` };
    });

    await boardHeaderChecks(page, c, SCRUM, "Active sprints", false);
  },
});
