// Lesson:  AUC-606 - Configure global user interface features in Jira
//          https://community.atlassian.com/learning/lesson/configure-global-user-interface-features-in-jira
// Image:   #2, section "Set the default user preferences" (Jira admin settings > System > Default user preferences
//          with the "User Default Settings" dialog open from Edit default values; the dialog is outlined with a marker
//          on each setting)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0c27rab646d5y1vrhl4601o65sn36465.png
// Recipe:  public.screenshot_recipes where asset_id = '0c27rab646d5y1vrhl4601o65sn36465'
// Opens Settings > System > Default user preferences and clicks Edit default values. Read only: nothing is changed in
// the dialog and Update is never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, heading, jadminTweaks, openSettingsPage } from "../lib/b3-jadmin";

const LABELS = ["Email format", "Work Items Per Page", "Default access", "Autowatch own work items"];
const dialog = (page: Page) => page.locator(".user-defaults-edit-dialog, .jira-dialog, [role=dialog]").filter({ hasText: "User Default Settings" }).first();
const labels = (page: Page) => dialog(page).locator("label").filter({ hasText: new RegExp(`^\\s*(${LABELS.join("|")})\\s*\\*?$`) });

runRecipe({
  file: "AUC-606-2",
  assetId: "0c27rab646d5y1vrhl4601o65sn36465",
  title: "AUC-606 #2 - Edit user default settings dialog",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/ViewUserDefaultSettings.jspa", heading(page, "User Default Settings"), "Default user preferences");
    await page.getByText("Edit default values", { exact: true }).first().click();
    await dialog(page).getByText("Email format").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [dialog(page)]);
    await markers(page, labels(page), "left", [200]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "System");
    await checkSidebar(c, page, "Sidebar: User interface > Default user preferences (selected)", ["User interface", "Default user preferences", "Default dashboard", "Look and feel", "Announcement banner"], "Default user preferences");

    await c.check("Page 'User Default Settings' behind the dialog", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Edit default values") && t.includes("Set the default values for user preferences");
      return { pass: ok, detail: ok ? "Present" : "Page text missing" };
    });

    await c.check("Dialog 'User Default Settings' open", async () => {
      const v = await dialog(page).isVisible();
      return { pass: v, detail: v ? "Open" : "Not open" };
    });

    await c.check("Fields: Email format, Work Items Per Page, Default access, Autowatch own work items", async () => {
      const text = await dialog(page).innerText();
      const missing = [...LABELS, "Number of Work Items displayed per Work Item navigator page", "For filters and dashboards"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Inputs: two dropdowns, a number box, a checkbox", async () => {
      const d = dialog(page);
      const selects = await d.locator("select").count();
      const text = await d.locator('input[type=text], input[type=number]').count();
      const cb = await d.locator("input[type=checkbox]").count();
      return { pass: selects >= 2 && text >= 1 && cb >= 1, detail: `Dropdowns: ${selects}; text boxes: ${text}; checkboxes: ${cb}` };
    });

    await c.check("Buttons: Update, Cancel", async () => {
      const update = await dialog(page).locator('input[value="Update"], button:text-is("Update")').first().isVisible().catch(() => false);
      const cancel = await dialog(page).getByText("Cancel", { exact: true }).first().isVisible().catch(() => false);
      return { pass: update && cancel, detail: `Update: ${update}; Cancel: ${cancel}` };
    });
  },
});
