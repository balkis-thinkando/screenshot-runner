// Lesson:  AUC-1755 - Visualize your team's work with the Summary view in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-project-summary
// Image:   #1, section "What is the Summary view?" (a software space Summary: activity counts, Status overview,
//          Recent activity, Priority breakdown, Types of work, Team workload, Epic progress)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/s7a70ee25i71114pjuchqcd75us31lt7.png
// Recipe:  public.screenshot_recipes where asset_id = 's7a70ee25i71114pjuchqcd75us31lt7'
// The lesson shows an internal Atlassian space; this uses the PLAT (Platform Development) Summary. The lesson image
// is the whole page; the capture is the top of the window. The "Customize your Reports view" banner is hidden
// (display only, not dismissed), and so is the sidebar. Counts, charts and activity change, so they are masked.
// People are shown with fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { hideMessages } from "../lib/tweaks";
import { fakeSpacePeople, hideJiraSidebar, openSpaceView, tabsCheck } from "../lib/b3-jsearch";

const WIDGETS = ["Status overview", "Recent activity", "Priority breakdown", "Types of work", "Team workload", "Epic progress"];
const widget = (page: Page, title: string) => page.getByRole("heading", { name: title }).first();

runRecipe({
  file: "AUC-1755-1",
  assetId: "s7a70ee25i71114pjuchqcd75us31lt7",
  title: "AUC-1755 #1 - Summary view",
  product: "jira",

  async navigate(page, s) {
    await openSpaceView(page, s, "/jira/software/c/projects/PLAT/summary", page.getByText(/completed/).first(), "the PLAT Summary");
    await widget(page, "Status overview").waitFor({ timeout: 30_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideMessages(page, ["Customize your Reports view"]);
    await hideJiraSidebar(page);
    await fakeSpacePeople(page, s, ["PLAT"]);
  },

  // Counts, charts and recent activity change all the time
  mask: (page) => [
    page.getByText(/^\d+ (completed|updated|created|due soon)$/),
    page.locator('[data-testid^="contextual-summary.ui.gadgets."]'),
  ],

  async checks(page, c) {
    await tabsCheck(page, c, "Summary", ["Active sprints", "Backlog", "All work", "Reports", "Components", "Forms", "Summary", "List", "Calendar", "Timeline"]);

    await c.check("Activity cards: completed, updated, created (last 7 days), due soon (next 7 days)", async () => {
      const all = await page.locator("body").innerText();
      const found = ["completed", "updated", "created", "due soon"].filter((w) => new RegExp(`\\d+ ${w}`).test(all));
      const missing = ["completed", "updated", "created", "due soon"].filter((w) => !found.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    for (const w of WIDGETS)
      await c.check(`Widget '${w}'`, async () => {
        const v = (await widget(page, w).count()) > 0;
        // With no recent changes in the space the activity widget only says "No activity yet"
        const empty = w === "Recent activity" && (await page.getByRole("heading", { name: "No activity yet" }).count()) > 0;
        return { pass: v, detail: v ? "Present" : empty ? "Test data: 'No activity yet' (no recent changes in the space)" : "Missing (UI change, or moved to the Reports view)" };
      });

    await c.check("Status overview: donut chart with a legend and 'View all work items'", async () => {
      const all = await page.locator("body").innerText();
      const link = all.includes("View all work items");
      const legend = /(To Do|In Progress|Done): \d+/.test(all);
      return { pass: link && legend, detail: `Link: ${link}; legend: ${legend}` };
    });

    await c.check("No people filter or Filter button above the cards (lesson has none)", async () => {
      const f = await page.getByRole("button", { name: /^Filter/ }).first().isVisible().catch(() => false);
      return { pass: !f, detail: f ? "UI change: people avatars and a Filter button now sit above the activity cards" : "None" };
    });
  },
});
