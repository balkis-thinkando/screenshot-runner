// Lesson:  AUC-612 - Configure attachment options, linking, and time tracking globally in Jira
//          https://community.atlassian.com/learning/lesson/configure-attachment-options-linking-and-time-tracking-globally-in-jira
// Image:   #3, section "Configure work linking" (Work item linking scrolled down to the "Add New Link Type" form; the
//          sidebar item and the form are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/wlw2x7a8m2ae7xd2w11nan433upx42ky
// Recipe:  public.screenshot_recipes where asset_id = 'wlw2x7a8m2ae7xd2w11nan433upx42ky'
// Opens Settings > Work items > Work item linking and scrolls to the empty Add New Link Type form. Read only: nothing is
// typed and Add is not clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { checkSidebar, checkSwitchSettings, heading, jadminTweaks, openSettingsPage, scrollSidebarTo, sidebarLink } from "../lib/b3-jadmin";

const formTitle = (page: Page) => heading(page, "Add New Link Type");
const addButton = (page: Page) => page.locator('input[type=submit][value="Add"], button:text-is("Add")').last();

const linkTable = (page: import("@playwright/test").Page) => page.locator("table").filter({ hasText: "Outward Description" }).last();

runRecipe({
  file: "AUC-612-3",
  assetId: "wlw2x7a8m2ae7xd2w11nan433upx42ky",
  title: "AUC-612 #3 - Add New Link Type form",
  product: "jira",

  async navigate(page, s) {
    await openSettingsPage(page, s, "/secure/admin/ViewLinkTypes!default.jspa", page.getByText(/Work item linking is currently/).first(), "Work item linking");
    await scrollSidebarTo(page, "Work item linking");
    // The lesson shows the form at the bottom of the window
    await addButton(page).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(800);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [sidebarLink(page, "Work item linking"), [formTitle(page), addButton(page)]]);
  },

  async checks(page, c) {
    await checkSwitchSettings(c, page, "Work items");
    await checkSidebar(c, page, "Sidebar: Work item linking selected", ["Time tracking", "Work item linking"], "Work item linking");

    await c.check("Form 'Add New Link Type' in view", async () => {
      const box = await formTitle(page).boundingBox();
      return { pass: !!box && box.y > 0 && box.y < 800, detail: box ? `Form title at y=${Math.round(box.y)}` : "Form title not found" };
    });

    await c.check("Fields: Name, Outward Link Description, Inward Link Description with examples", async () => {
      const text = await page.locator("form").filter({ has: formTitle(page) }).first().innerText().catch(() => page.locator("body").innerText());
      const missing = ["Add a new link type", "Name", "Outward Link Description", "Inward Link Description", '(eg "Duplicate")', '(eg "duplicates")', '(eg "is duplicated by")'].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Add button", async () => {
      const v = await addButton(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Link types listed above the form (Relates, Resolve)", async () => {
      const text = await linkTable(page).innerText();
      const missing = ["Relates", "Resolve", "Problem/Incident", "Post-Incident Reviews"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
