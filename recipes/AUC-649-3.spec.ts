// Lesson:  AUC-649 - Configure global permissions in Jira
//          https://community.atlassian.com/learning/lesson/configure-global-permissions-in-jira
// Image:   #3, section "Grant global permissions to the Public" (Global permissions scrolled to the Grant Permission
//          form with Grant = Browse users and groups and Group = Public, which shows the "Heads up" warning; the form
//          is outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0k4e7a6k4y588jto38ty82clar2e3w21
// Recipe:  public.screenshot_recipes where asset_id = '0k4e7a6k4y588jto38ty82clar2e3w21'
// Opens Settings > System > Global permissions, scrolls to Grant Permission and picks the two values. Read only:
// Add is never clicked, so nothing is granted.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, heading, jadminTweaks, openSettingsPage } from "../lib/b3-jadmin";

const grant = (page: Page) => page.locator('select[name="globalPermType"]');
const group = (page: Page) => page.locator('select[name="groupName"]'); // hidden; the AUI picker below is what shows
const groupField = (page: Page) => page.locator("#groupName_select-field");
const warning = (page: Page) => page.getByText(/Anyone on the internet can perform these tasks/).first();
const addButton = (page: Page) => page.locator('input[type=submit][value="Add"], button:text-is("Add")').last();

runRecipe({
  file: "AUC-649-3",
  assetId: "0k4e7a6k4y588jto38ty82clar2e3w21",
  title: "AUC-649 #3 - Grant Permission to Public",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/GlobalPermissions!default.jspa", heading(page, "Global Permissions"), "Global permissions");
    await grant(page).selectOption("USER_PICKER");
    // The Group picker is an AUI single select: type the group and pick the suggestion
    await groupField(page).click();
    await groupField(page).pressSequentially("Public", { delay: 60 });
    const option = page.locator("#groupName_select-suggestions li").filter({ hasText: /^Public$/ }).first();
    await option.waitFor({ timeout: 15_000 });
    await option.hover();
    await option.click();
    // No focus ring or text selection in the lesson
    await groupField(page).evaluate((e) => (e as HTMLInputElement).blur());
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await warning(page).waitFor({ timeout: 10_000 }).catch(() => {});
    // Form near the bottom of the window with the Add button below it, as in the lesson
    await addButton(page).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(800);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [[heading(page, "Grant Permission"), groupField(page), warning(page)]]);
  },

  async checks(page, c) {
    await checkSidebar(c, page, "Sidebar: Global permissions selected", ["Space roles", "Global permissions"], "Global permissions");

    await c.check("Grant Permission form in view", async () => {
      const box = await heading(page, "Grant Permission").boundingBox();
      return { pass: !!box && box.y > 0 && box.y < 800, detail: box ? `Title at y=${Math.round(box.y)}` : "Title not found" };
    });

    await c.check("Grant dropdown set to 'Browse users and groups'", async () => {
      const v = await grant(page).evaluate((e: HTMLSelectElement) => e.options[e.selectedIndex]?.text ?? "");
      return { pass: v === "Browse users and groups", detail: `Grant: "${v}"` };
    });

    await c.check("Group dropdown set to 'Public'", async () => {
      const v = await group(page).evaluate((e: HTMLSelectElement) => e.options[e.selectedIndex]?.text ?? "");
      return { pass: v === "Public", detail: `Group: "${v}"` };
    });

    await c.check("Warning 'Heads up: Anyone on the internet can perform these tasks...'", async () => {
      const v = await warning(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Shown" : "Not shown" };
    });

    await c.check("Add button below the form", async () => {
      const v = await addButton(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
