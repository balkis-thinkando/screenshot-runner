// Lesson:  AUC-606 - Configure global user interface features in Jira
//          https://community.atlassian.com/learning/lesson/configure-global-user-interface-features-in-jira
// Image:   #3, section "Configure the default dashboard" (Jira admin settings > System > Default dashboard, the
//          "Configure Default Dashboard" page; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/48y2772q33ck5bmi7pf30el0c2wi20k5.png
// Recipe:  public.screenshot_recipes where asset_id = '48y2772q33ck5bmi7pf30el0c2wi20k5'
// Opens Settings > System > Default dashboard. Read only: Add gadget, Change layout and Done are not clicked.
// The gadget check reports gadgets missing from the site's default dashboard as test data (one Nov 2026 load showed
// Pie Chart, Filter counts, Issue Statistics and Projects instead of the lesson's set). Gadgets list real people (assignees, space leads) as plain text, so they
// get fake names (display only); gadget contents change daily, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { FAKE_PEOPLE } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, fakeGadgetPeople, heading, jadminTweaks, openSettingsPage } from "../lib/b3-jadmin";

const LESSON_GADGETS = ["Pie Chart", "Assigned to Me", "Activity Stream", "Watched Issues", "Issues in progress", "Issues Calendar"];
const gadgets = (page: Page) => page.locator(".gadget, [data-testid*='gadget'], .dashboard-item-frame, [id^='gadget-']");

runRecipe({
  file: "AUC-606-3",
  assetId: "48y2772q33ck5bmi7pf30el0c2wi20k5",
  title: "AUC-606 #3 - Configure Default Dashboard",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/EditDefaultDashboard!default.jspa", page.getByText("Configure Default Dashboard").first(), "Default dashboard");
    await page.getByText(/Last refreshed/).first().waitFor({ timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await fakeGadgetPeople(page, FAKE_PEOPLE.slice(1));
    await jadminTweaks(page, s);
  },

  mask: (page) => [gadgets(page)],

  async checks(page, c) {
    await checkSwitchSettings(c, page, "System");
    await checkSidebar(c, page, "Sidebar: User interface > Default dashboard (selected)", ["User interface", "Default user preferences", "Default dashboard", "Look and feel"], "Default dashboard");

    await c.check("Title 'Configure Default Dashboard' and the DEFAULT dashboard note", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Configure Default Dashboard") && t.includes("You are now configuring the DEFAULT dashboard");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Dashboard 'Default dashboard' with Add gadget, Change layout, Done", async () => {
      const title = await heading(page, "Default dashboard").isVisible().catch(() => false);
      const t = await page.locator("body").innerText();
      const missing = ["Add gadget", "Change layout", "Done"].filter((b) => !t.includes(b));
      return { pass: title && !missing.length, detail: `Title: ${title}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Gadgets of the lesson: Pie Chart, Assigned to Me, Activity Stream, Watched Issues, Issues in progress, Issues Calendar", async () => {
      const t = await page.locator("body").innerText();
      const missing = LESSON_GADGETS.filter((g) => !t.toLowerCase().includes(g.toLowerCase()));
      const recased = LESSON_GADGETS.filter((g) => !t.includes(g) && t.toLowerCase().includes(g.toLowerCase()));
      return {
        pass: !missing.length,
        detail: `${missing.length ? `Test data: the default dashboard has other gadgets; missing: ${missing.join(", ")}` : "All present"}${recased.length ? `; title case differs (UI change): ${recased.join(", ")}` : ""}`,
      };
    });
  },
});
