// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #7, section "Let's explore an example" (Jira admin settings > Work items > Time tracking; the "Global time
//          tracking settings" box is outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/22833008517812vp04m8t5a26xkb5pc0
// Recipe:  public.screenshot_recipes where asset_id = '22833008517812vp04m8t5a26xkb5pc0'
// Opens Settings > Work items > Time tracking. Read only. The lesson's example values (6 hours a day, Hour) differ from
// the site's (Nov 2026: 8, Minute); values are reported in the check detail, only the labels must match.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, heading, jadminTweaks, mainText, openSettingsPage, scrollSidebarTo } from "../lib/b3-jadmin";

const LABELS = ["Working hours per day", "Working days per week", "Time display format", "Default unit for time tracking", "Copying of comments to work description"];
const box = (page: Page) => [heading(page, "Global time tracking settings"), page.getByText("Copying of comments to work description").first().locator("xpath=ancestor::tr[1]")];

runRecipe({
  file: "AUC-612-7",
  assetId: "22833008517812vp04m8t5a26xkb5pc0",
  title: "AUC-612 #7 - Global time tracking settings",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/TimeTrackingAdmin.jspa", heading(page, "Time tracking"), "Time tracking");
    await scrollSidebarTo(page, "Time tracking");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    const parts = box(page);
    const row = (await parts[1].count()) ? parts[1] : page.getByText("Copying of comments to work description").first();
    await spotlightAreas(page, [[parts[0], row]]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "Work items");
    await checkSidebar(c, page, "Sidebar: Work item features > Time tracking (selected)", ["Time tracking", "Work item linking"], "Time tracking");

    await c.check("Time tracking provider: JIRA provided time tracking", async () => {
      const text = await mainText(page);
      const ok = text.includes("Time tracking provider") && text.includes("JIRA provided time tracking");
      return { pass: ok, detail: ok ? "Present" : "Provider row or value missing" };
    });

    await c.check("Global time tracking settings: the five settings (values may differ from the lesson's example)", async () => {
      const text = await mainText(page);
      const missing = LABELS.filter((t) => !text.includes(t));
      const value = (l: string) => (text.split(l)[1] ?? "").split("\n").map((v) => v.trim()).filter(Boolean)[0] ?? "?";
      const values = LABELS.map((l) => `${l.split(" ").slice(0, 2).join(" ")}=${value(l)}`).join("; ");
      const title = await heading(page, "Global time tracking settings").isVisible().catch(() => false);
      return { pass: title && !missing.length, detail: `Box title: ${title}; ${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}${values} (lesson: 6, 5, Pretty, Hour, Enabled)` };
    });

    await c.check("Note on Work On work items permission and Edit global settings button", async () => {
      const text = await mainText(page);
      const note = text.includes("Work On work items");
      const edit = text.includes("Edit global settings");
      return { pass: note && edit, detail: `Note: ${note}; Edit global settings: ${edit}` };
    });
  },
});
