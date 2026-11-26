// Lesson:  AUC-1727 - Create search filters in Jira
//          https://community.atlassian.com/learning/lesson/create-jira-search-filters
// Image:   #1, section "Create a filter" (Save filter dialog with a name typed and the Editors list open; arrows
//          point at Viewers and Editors)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/5o0vdt1y26f1msb07bo4p20f62310066.png
// Recipe:  public.screenshot_recipes where asset_id = '5o0vdt1y26f1msb07bo4p20f62310066'
// All work with an Employee Onboarding query, Save filter clicked, a name typed and the Editors list opened.
// The dialog is never saved: the run ends with it open. The lesson's filter name uses the first name of a real
// demo account on the site, so a neutral name is typed instead. Results and recent sidebar items are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { fakeNames } from "../lib/tweaks";
import { jiraPeopleTweaks } from "../lib/b2-jira";
import { openJql, sidebarRecent } from "../lib/b3-jsearch";

const JQL = "project = EO ORDER BY created DESC";
const NAME = "My team's items";
const dialog = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.getByRole("heading", { name: "Save filter" }) }).first();
const nameInput = (page: Page) => page.locator('[data-testid="shareable-entity-dialog.text-field"]');
// The Viewers and Editors pickers are react-select comboboxes, in that order
const picker = (page: Page, i: number) => dialog(page).locator('input[role="combobox"]').nth(i);
const listOptions = (page: Page) => page.locator('[id^="react-select-"][id*="-option-"]:visible, [role="listbox"] [role="option"]:visible');

runRecipe({
  file: "AUC-1727-1",
  assetId: "5o0vdt1y26f1msb07bo4p20f62310066",
  title: "AUC-1727 #1 - Save filter dialog, Editors list open",
  product: "jira",

  async navigate(page, s) {
    await openJql(page, s, JQL);
    await page.locator("table tbody tr").first().waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Save filter" }).first().click();
    await nameInput(page).waitFor({ timeout: 15_000 });
    await nameInput(page).fill(NAME);
    await picker(page, 1).click();
    await listOptions(page).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
    await fakeNames(page, "Employee");
  },

  mask: (page) => [page.locator("table tbody"), page.getByText(/^\d+ of \d+\+?$/), ...sidebarRecent(page)],

  async checks(page, c) {
    await c.check("Save filter dialog with Name (required) and the typed name", async () => {
      const title = await dialog(page).getByRole("heading", { name: "Save filter" }).isVisible().catch(() => false);
      const req = (await dialog(page).innerText()).includes("Required fields are marked with an asterisk");
      const v = await nameInput(page).inputValue();
      return { pass: title && req && v === NAME, detail: `Title: ${title}; required note: ${req}; name: "${v}"` };
    });

    await c.check("Fields: Name, Description, Viewers, Editors, each picker with Add", async () => {
      const text = await dialog(page).innerText();
      const missing = ["Name", "Description", "Viewers", "Editors"].filter((t) => !text.includes(t));
      const adds = await dialog(page).getByRole("button", { name: /^Add (viewers|editors)$/ }).count();
      return { pass: !missing.length && adds === 2, detail: `Missing: ${missing.join(", ") || "none"}; Add buttons: ${adds}` };
    });

    await c.check("Viewers and Editors default to Private (Only you)", async () => {
      const text = await dialog(page).innerText();
      const priv = (text.match(/Private/g) ?? []).length;
      const only = text.includes("Only you");
      return { pass: priv >= 2 && only, detail: `"Private" shown ${priv} times; "Only you": ${only}` };
    });

    await c.check("Editors list open: Space, Group, User, Private", async () => {
      const items = (await listOptions(page).allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const missing = ["Space", "Group", "User", "Private"].filter((t) => !items.includes(t));
      return { pass: !missing.length, detail: `Options: ${items.join(", ")}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Buttons: Cancel, Save (not clicked)", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible();
      const save = await dialog(page).getByRole("button", { name: "Save", exact: true }).isVisible();
      return { pass: cancel && save, detail: `Cancel: ${cancel}; Save: ${save}` };
    });
  },
});
