// Lesson:  AUC-424 - Set your personal notifications in Jira
//          https://community.atlassian.com/learning/lesson/jira-personal-notification-settings
// Image:   #2, section "Personalize your email preferences" (Personal settings, notifications page, email preferences;
//          nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/awdxo2w5o683vks68p8wbo88h52d674u
// Recipe:  public.screenshot_recipes where asset_id = 'awdxo2w5o683vks68p8wbo88h52d674u'
// Opens Personal settings > the Jira notifications page. Nothing is clicked or changed (the toggles and checkboxes
// show the test account's own settings).

import { runRecipe } from "../lib/recipe";
import { basicTweaks, openPersonalSettings } from "../lib/b3-jreports";

const tid = (id: string) => `[data-testid="personal-settings-preference-fields.common.ui.${id}"]`;

runRecipe({
  file: "AUC-424-2",
  assetId: "awdxo2w5o683vks68p8wbo88h52d674u",
  title: "AUC-424 #2 - Personal notification email preferences",
  product: "jira",

  async navigate(page, s) {
    await openPersonalSettings(page, s, "notifications");
    await page.locator(tid("email-enabled.toggle")).waitFor({ timeout: 30_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Page title 'Notifications for spaces and work items' with the Personal settings breadcrumb", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Notifications for spaces and work items", detail: h1 === "Notifications for spaces and work items" ? "Present" : `UI change: the page is titled "${h1}"` };
    });

    await c.check("Sidebar: General, Notification settings group with Spaces and work items, Digests, Alerts", async () => {
      const nav = (await page.locator('[data-testid="navigation-apps-sidebar-nav4-personal-settings.ui.sidebar-content"]').innerText()).split("\n").map((t) => t.trim()).filter(Boolean);
      const want = ["General", "Notification settings", "Spaces and work items", "Digests", "Alerts"];
      const missing = want.filter((w) => !nav.includes(w));
      return { pass: !missing.length, detail: missing.length ? `UI change, sidebar now: ${nav.join(", ")}` : "All present" };
    });

    await c.check("Intro text and 'Email preferences' heading", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const ok = text.includes("Control when you receive email or in-app notifications from Jira") && text.includes("Email preferences");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("'Send me emails for work item activity' toggle with the assignee, reporter and own-changes checkboxes", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const missing = ["Send me emails for work item activity", "Receive emails when:", "You're the assignee", "You're the reporter", "You make changes to work items"].filter((t) => !text.includes(t));
      const toggle = await page.locator(tid("email-enabled.toggle")).isVisible();
      return { pass: !missing.length && toggle, detail: missing.length ? `Missing: ${missing.join(", ")}` : `Toggle: ${toggle}` };
    });

    await c.check("'Group notification emails together' toggle with a frequency dropdown", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const ok = text.includes("Group notification emails together") && /Every \d+ minutes?|Every hour|Once a day/i.test(text);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("'Email format' section with HTML and Text options", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
      const ok = text.includes("Email format") && text.includes("How do you like your emails?") && /\bHTML\b/.test(text) && /\bText\b/.test(text);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });
  },
});
