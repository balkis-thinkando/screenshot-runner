// Lesson:  AUC-1754 - Schedule work with the Timeline and Calendar views in Jira
//          https://community.atlassian.com/learning/lesson/schedule-work-with-jira-timeline-and-calendar-view
// Image:   #5, section "Explore the Timeline view" (the #1 Timeline with outlines and markers: search and filters,
//          view settings / refresh / more, the Work column with an expanded epic, a warning icon, Create, and the
//          Today / Weeks / Months / Quarters switch)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14P32.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14P32'
// Same stand-in as AUC-1754-1: the MMC Timeline (M0018 - Museum Communication), both epics expanded, chart from
// February 2027, sidebar hidden (display only). The lesson's warning icon (a bar past its due date) has no match
// in the test data. People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlightAreas } from "../lib/tweaks";
import { fakeSpacePeople, markBox, MMC, openMmcTimeline, tabsCheck, timelineChecks } from "../lib/b3-jsearch";

const today = (page: Page) => page.getByRole("button", { name: "Today", exact: true }).last();
const quarters = (page: Page) => page.getByRole("button", { name: "Quarters", exact: true }).or(page.getByRole("radio", { name: "Quarters", exact: true })).first();
const search = (page: Page) => page.getByPlaceholder(/Search timeline/).first();
const filter = (page: Page) => page.getByRole("button", { name: /^Filter/ }).first();

runRecipe({
  file: "AUC-1754-5",
  assetId: "AT14P32",
  title: "AUC-1754 #5 - Timeline view parts",
  product: "jira",

  async navigate(page, s) {
    await openMmcTimeline(page, s);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeSpacePeople(page, s, [MMC.key]);
    // Toolbar buttons at the right (view settings, more actions), found by position
    const right = await markBox(page, "timeline-right-tools", () => {
      const search = document.querySelector('input[placeholder^="Search timeline"]');
      if (!search) return null;
      const y = search.getBoundingClientRect().top + search.getBoundingClientRect().height / 2;
      const r = Array.from(document.querySelectorAll("button"))
        .map((b) => b.getBoundingClientRect())
        .filter((b) => b.width > 0 && b.left > innerWidth / 2 && b.top < y && b.bottom > y);
      return r.length ? { left: Math.min(...r.map((b) => b.left)), top: Math.min(...r.map((b) => b.top)), right: Math.max(...r.map((b) => b.right)), bottom: Math.max(...r.map((b) => b.bottom)) } : null;
    });
    // The Work column, from its header to the last child of the first epic
    const work = await markBox(page, "timeline-work-column", () => {
      const head = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent?.trim() === "Work");
      const status = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent?.trim() === "Status");
      const last = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.trim() === "MMC-6");
      if (!head || !status || !last) return null;
      const h = head.getBoundingClientRect();
      return { left: h.left - 30, top: h.top - 12, right: status.getBoundingClientRect().left - 12, bottom: last.getBoundingClientRect().bottom + 10 };
    });
    await spotlightAreas(page, [
      // The search box's own frame is the input's parent
      [search(page).locator("xpath=.."), filter(page)],
      right,
      work,
      page.getByRole("button", { name: "Create", exact: true }).last(),
      [today(page), quarters(page)],
    ]);
    await markers(page, filter(page), "down", [1]);
  },

  async checks(page, c) {
    await tabsCheck(page, c, "Timeline", ["Summary", "Board", "List", "Calendar", "Timeline", "Approvals", "Forms", "Docs", "Attachments", "Reports"]);
    await timelineChecks(page, c);
  },
});
