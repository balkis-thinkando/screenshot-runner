// Lesson:  AUC-413 - Adjust your personal settings in Confluence
//          https://community.atlassian.com/learning/lesson/adjust-your-personal-settings-in-confluence
// Image:   #3, section "Personalize your email preferences" (Personal settings > Email: the General settings
//          block outlined: Autowatch, All blog posts, Notify on my actions)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/yw0xorm0a41g35un4ndu622a85o2c00u.png
// Recipe:  public.screenshot_recipes where asset_id = 'yw0xorm0a41g35un4ndu622a85o2c00u'
// Opens the test account's email settings in edit mode (the page the Edit button opens), as in the lesson.
// Nothing is ticked or submitted. The checkbox states are the test
// account's own preferences, so they are reported but not checked. The account name is a fake name.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, openWikiPath } from "../lib/b3-conf";

const content = (page: Page) => page.locator("body");
const general = (page: Page) => content(page).getByText("General settings", { exact: true }).first();
const option = (page: Page, label: string) => content(page).getByText(label, { exact: true }).first();

runRecipe({
  file: "AUC-413-3",
  assetId: "yw0xorm0a41g35un4ndu622a85o2c00u",
  title: "AUC-413 #3 - Personal settings email",
  product: "confluence",

  async navigate(page, s) {
    await openWikiPath(page, s, "/users/editmyemailsettings.action", general(page), "the email settings");
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    // The General settings block: its heading down to the last option's description
    await dimAreas(page, [[general(page), content(page).getByText(/notifications for changes you make/).first()]]);
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Tabs: Personal settings, Tasks, Saved for later, Watches, Network", async () => {
      const want = ["Personal settings", "Tasks", "Saved for later", "Watches", "Network"];
      const missing = [];
      for (const w of want) if (!(await page.getByRole("link", { name: w, exact: true }).first().isVisible().catch(() => false))) missing.push(w);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Settings menu: Password, Email, Editor", async () => {
      const missing = [];
      for (const w of ["Password", "Email", "Editor"]) if (!(await page.getByRole("link", { name: w, exact: true }).first().isVisible().catch(() => false))) missing.push(w);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Email heading with Submit and Cancel", async () => {
      const h = (await content(page).getByText("Email", { exact: true }).count()) >= 2; // the menu link and the heading
      const submit = await content(page).getByRole("button", { name: "Submit" }).or(content(page).locator('input[value="Submit"]')).first().isVisible();
      const cancel = await content(page).getByText("Cancel", { exact: true }).or(content(page).getByRole("link", { name: "Cancel" })).first().isVisible();
      return { pass: h && submit && cancel, detail: `Email heading: ${h}; Submit: ${submit}; Cancel: ${cancel}` };
    });

    await c.check("General settings: Autowatch, All blog posts, Notify on my actions", async () => {
      const missing = [];
      for (const w of ["Autowatch", "All blog posts", "Notify on my actions"]) if (!(await option(page, w).isVisible().catch(() => false))) missing.push(w);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Subscribe to section below", async () => {
      const v = await content(page).getByText("Subscribe to", { exact: true }).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
  },
});
