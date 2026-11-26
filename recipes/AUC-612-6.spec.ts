// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #6, section "Time tracking in Jira" (Time tracking page with the "Time tracking settings" dialog open from
//          Edit global settings; the dialog is outlined with a marker on each setting)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/nyd88k8j6842p5g874668bxlt2x3o7y1
// Recipe:  public.screenshot_recipes where asset_id = 'nyd88k8j6842p5g874668bxlt2x3o7y1'
// Opens Settings > Work items > Time tracking and clicks Edit global settings. Read only: nothing is changed in the
// dialog and Save is never clicked (the dialog is left open; the next page load discards it).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { markers, spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, heading, jadminTweaks, openSettingsPage, scrollSidebarTo } from "../lib/b3-jadmin";

const LABELS = ["Working hours per day", "Working days per week", "Time display format", "Default unit", "Copying of comments to work description"];
// The whole AUI dialog (header included), not its inner content section
const dialog = (page: Page) =>
  page.locator(".time-tracking-configuration-dialog").or(page.locator("[role=dialog]").filter({ hasText: "Time tracking settings" })).first();
const labels = (page: Page) => dialog(page).locator("label, dt, th, strong, b, span, div").filter({ hasText: new RegExp(`^\\s*(${LABELS.join("|")})\\s*$`) });

runRecipe({
  file: "AUC-612-6",
  assetId: "nyd88k8j6842p5g874668bxlt2x3o7y1",
  title: "AUC-612 #6 - Time tracking settings dialog",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/TimeTrackingAdmin.jspa", heading(page, "Time tracking"), "Time tracking");
    await scrollSidebarTo(page, "Time tracking");
    await page.getByRole("button", { name: "Edit global settings" }).or(page.getByRole("link", { name: "Edit global settings" })).or(page.getByText("Edit global settings", { exact: true })).first().click();
    await dialog(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    // One marker per setting label (innermost element with that text)
    const inner = labels(page).filter({ hasNot: page.locator("span, div, strong, b") });
    // The AUI dialog's header is drawn above its section's box, so the outlined area is header plus section
    const section = page.locator("section.aui-dialog2:visible").filter({ hasText: "Working hours per day" }).first();
    await spotlightAreas(page, [[section.locator("xpath=preceding-sibling::header[1] | ./header").first().or(page.locator("header.aui-dialog2-header:visible").first()), section]]);
    await markers(page, (await inner.count()) ? inner : labels(page), "left", [180]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "Work items");
    await checkSidebar(c, page, "Sidebar: Work item features > Time tracking (selected)", ["Time tracking", "Work item linking"], "Time tracking");

    await c.check("Dialog 'Time tracking settings' open", async () => {
      const v = await dialog(page).isVisible();
      return { pass: v, detail: v ? "Open" : "Not open" };
    });

    await c.check("Settings: Working hours per day, Working days per week, Time display format, Default unit, Copying of comments", async () => {
      const text = await dialog(page).innerText();
      const missing = LABELS.filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Inputs: two number boxes, two dropdowns, a toggle", async () => {
      const d = dialog(page);
      const inputs = await d.locator('input[type=text], input[type=number], input:not([type])').count();
      const selects = await d.locator('select, [role=combobox]').count();
      const toggle = await d.locator('input[type=checkbox], [role=switch], aui-toggle').count();
      return { pass: inputs >= 2 && selects >= 2 && toggle >= 1, detail: `Text boxes: ${inputs}; dropdowns: ${selects}; toggles: ${toggle}` };
    });

    await c.check("Buttons: Save, Cancel", async () => {
      const text = await dialog(page).innerText();
      const ok = /Save/.test(text) && /Cancel/.test(text);
      return { pass: ok, detail: ok ? "Present" : `Footer: ${text.slice(-60)}` };
    });
  },
});
