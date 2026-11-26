// Lesson:  AUC-389 - Adjust your personal settings in Jira
//          https://community.atlassian.com/learning/lesson/adjust-your-jira-personal-settings
// Image:   #4, section "Turn on dark mode" (the Theme options are outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT125Y.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT125Y'
// Opens Personal settings > General and scrolls the Theme options into view. No theme is picked.

import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { basicTweaks, generalPageChecks, openPersonalSettings } from "../lib/b3-jreports";

const themeHeading = (page: import("@playwright/test").Page) => page.locator('[data-testid="page-layout.main"]').getByText("Theme", { exact: true }).first();
const option = (page: import("@playwright/test").Page, name: string) => page.locator('[data-testid="page-layout.main"]').getByText(name, { exact: true }).first();

runRecipe({
  file: "AUC-389-4",
  assetId: "AT125Y",
  title: "AUC-389 #4 - Theme options",
  product: "jira",

  async navigate(page, s) {
    await openPersonalSettings(page, s, "general");
    await themeHeading(page).waitFor({ timeout: 30_000 });
    // As in the lesson: the Theme options near the bottom of the window
    await page.locator('[data-testid="page-layout.main"] input[type="radio"]').first().evaluate((el) => {
      let card = el as HTMLElement;
      for (let a = el.parentElement; a && a.getBoundingClientRect().width <= 300; a = a.parentElement) card = a;
      card.scrollIntoView({ block: "end" });
      // A little space under the cards, as in the lesson
      const scroller = (function find(e: HTMLElement | null): HTMLElement | null {
        for (; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e;
        return null;
      })(card);
      (scroller ?? document.scrollingElement)?.scrollBy(0, 40);
    });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
    // The three option cards: around each theme radio, the widest ancestor still under 300px
    await page.locator('[data-testid="page-layout.main"] input[type="radio"]').evaluateAll((radios) =>
      radios.slice(0, 3).forEach((r, i) => {
        let card = r as HTMLElement;
        for (let a = r.parentElement; a; a = a.parentElement) {
          const w = a.getBoundingClientRect().width;
          if (w > 300) break;
          card = a;
        }
        card.setAttribute("data-screenshot-card", String(i));
      }),
    );
    // The heading block is full width; the lesson's outline ends after the cards
    await themeHeading(page).evaluate((el) => ((el as HTMLElement).style.width = "fit-content"));
    await spotlightAreas(page, [[themeHeading(page), page.locator('[data-screenshot-card="0"]'), page.locator('[data-screenshot-card="2"]')]]);
  },

  async checks(page, c) {
    await generalPageChecks(page, c);
    await c.check("Theme options are radio cards with previews: Light (selected), Dark, Match browser", async () => {
      const radios = await page.locator('[data-testid="page-layout.main"] input[type="radio"]').count();
      const light = await page.locator('[data-testid="page-layout.main"] input[type="radio"]').first().isChecked().catch(() => false);
      const ok = radios >= 3 && (await option(page, "Match browser").isVisible());
      return { pass: ok && light, detail: `Radios: ${radios}; first (Light) selected: ${light}` };
    });
  },
});
