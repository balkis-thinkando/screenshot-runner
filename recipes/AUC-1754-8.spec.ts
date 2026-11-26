// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #8, section "Explore the Calendar view" (the #2 Calendar with the Unscheduled work panel open; outlines on
//          search and filters, date controls, a day cell and the panel)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/5dfvo14t4sg7708o8kdhmey54ao01lc0.png
// Recipe:  public.screenshot_recipes where asset_id = '5dfvo14t4sg7708o8kdhmey54ao01lc0'
// Stand-in space (see AUC-1754-1): the MMC Calendar on March 2027 with the Unscheduled work panel open (a view
// toggle, nothing saved). The unscheduled items are MMC's two epics (no dates). Sidebar hidden, display only.
// People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import {
  calendarChecks, calendarRange, calendarToday, fakeSpacePeople, MMC, openMmcCalendar, tabsCheck, unscheduledPanel, viewSettings,
} from "../lib/b3-jsearch";

const panelHeading = (page: Page) => page.getByRole("heading", { name: "Unscheduled work" });

runRecipe({
  file: "AUC-1754-8",
  assetId: "5dfvo14t4sg7708o8kdhmey54ao01lc0",
  title: "AUC-1754 #8 - Calendar with Unscheduled work",
  product: "jira",

  async navigate(page, s) {
    await openMmcCalendar(page, s, true);
    await panelHeading(page).waitFor({ timeout: 15_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, [MMC.key]);
    await spotlightAreas(page, [
      // The search box's own frame is the input's parent
      [page.getByPlaceholder(/Search calendar/).first().locator("xpath=.."), page.getByRole("button", { name: /^Filter/ }).first()],
      [calendarToday(page), calendarRange(page), viewSettings(page)],
      unscheduledPanel(page),
    ]);
  },

  async checks(page, c) {
    await tabsCheck(page, c, "Calendar", ["Summary", "Board", "List", "Calendar", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports"]);
    await calendarChecks(page, c);

    await c.check("Unscheduled work panel: title, close, hint, search box", async () => {
      const panel = unscheduledPanel(page);
      const text = await panel.innerText().catch(() => "");
      const hint = text.includes("Drag each work item onto the calendar to set a due date for the work.");
      const search = await page.getByPlaceholder(/Search unscheduled items/).isVisible().catch(() => false);
      const close = await panel.getByRole("button", { name: /close/i }).first().isVisible().catch(() => false);
      return { pass: hint && search && close, detail: `Hint: ${hint}; search: ${search}; close: ${close}` };
    });

    await c.check("Panel list: Most recent sort, Filters, work item cards", async () => {
      const all = await page.locator("body").innerText();
      const sort = all.includes("Most recent");
      const filters = /(^|\n)Filters(\n|$)/.test(all);
      const cards = (await unscheduledPanel(page).innerText().catch(() => "")).match(/MMC-\d+/g)?.length ?? 0;
      return { pass: sort && filters && cards > 0, detail: `Most recent: ${sort}; Filters: ${filters}; cards: ${cards}` };
    });
  },
});
