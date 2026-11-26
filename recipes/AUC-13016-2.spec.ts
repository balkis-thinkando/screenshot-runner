// Lesson:  AUC-13016 - Add users to a Jira space
//          https://community.atlassian.com/learning/lesson/add-user-to-jira-space
// Image:   #2, section "Create a new space role" (Space settings > Access of the Employee Onboarding team-managed
//          space with the "Create role" dialog: name "Developer", description "Engineers & staff", Manage work items
//          ticked; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/0yw16jlg06w2i2ug54x1654nupb3n8l2
// Recipe:  public.screenshot_recipes where asset_id = '0yw16jlg06w2i2ug54x1654nupb3n8l2'
// Opens Space settings > Access of Employee Onboarding (EO), Settings (gear) > Manage roles > Create role, types the
// lesson's name and description and ticks "Manage ... work items". Read only: Create is never clicked (the dialog is
// discarded with the page).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { jadminTweaks, openSpaceAccess } from "../lib/b3-jadmin";

const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: "Create role" }).last();
const manageItems = (page: Page) => dialog(page).getByRole("checkbox", { name: /^Manage "Employee Onboarding" (work items|issues)/ }).first();

runRecipe({
  file: "AUC-13016-2",
  assetId: "0yw16jlg06w2i2ug54x1654nupb3n8l2",
  title: "AUC-13016 #2 - Create role dialog",
  product: "jira",

  async navigate(page, s) {
    await openSpaceAccess(page, s, "EO");
    // The gear next to Open access opens a menu with Manage roles
    await page.locator('button:has-text("Open access")').locator("xpath=following::button[1]").click();
    await page.getByRole("menuitem", { name: "Manage roles" }).or(page.getByText("Manage roles", { exact: true })).first().click();
    await page.getByRole("button", { name: /Create role/ }).first().click({ timeout: 30_000 });
    await dialog(page).locator("#manage-role-name").waitFor({ timeout: 30_000 });
    await dialog(page).locator("#manage-role-name").fill("Developer");
    await dialog(page).locator("#manage-role-description").fill("Engineers & staff");
    await manageItems(page).check();
    await page.waitForTimeout(1_000);
    // Ticking scrolls the dialog body; the lesson shows it from the top (Name and Description visible)
    await dialog(page).locator("#manage-role-name").evaluate((el) => {
      let p: HTMLElement | null = el.parentElement;
      while (p && !(p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
      if (p) p.scrollTop = 0;
    });
    await dialog(page).locator("#manage-role-name").blur();
    await page.waitForTimeout(500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Behind the dialog: Space settings > Access of the Employee Onboarding business space", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Space settings") && t.includes("Employee Onboarding") && /Access/.test(t);
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Dialog 'Create role' with Name 'Developer' and Description 'Engineers & staff'", async () => {
      const name = await dialog(page).locator("#manage-role-name").inputValue().catch(() => "");
      const desc = await dialog(page).locator("#manage-role-description").inputValue().catch(() => "");
      return { pass: name === "Developer" && desc === "Engineers & staff", detail: `Name: "${name}"; description: "${desc}"` };
    });

    await c.check("'People in this role can:' with Administer and Manage work items options", async () => {
      const t = await dialog(page).innerText();
      const admin = t.includes('Administer "Employee Onboarding"');
      const manage = /Manage "Employee Onboarding" work items/.test(t);
      const old = /Manage "Employee Onboarding" issues/.test(t);
      return { pass: t.includes("People in this role can:") && admin && manage, detail: `Administer: ${admin}; Manage work items: ${manage ? "yes" : old ? "UI change: says 'issues' instead of 'work items'" : "missing"}` };
    });

    await c.check("Manage work items ticked, with sub-permission 'Add or remove work item watchers' ticked", async () => {
      const checked = await manageItems(page).isChecked().catch(() => false);
      const sub = dialog(page).getByRole("checkbox", { name: /^Add or remove (work item|issue) watchers/ }).first();
      const subChecked = await sub.isChecked().catch(() => false);
      const subName = (await sub.getAttribute("aria-label").catch(() => null)) ?? (await dialog(page).getByText(/^Add or remove (work item|issue) watchers$/).first().innerText().catch(() => "?"));
      // The wording (issue / work item) is checked above; this check is about the ticked state
      return { pass: checked && subChecked, detail: `Manage ticked: ${checked}; sub-permission ticked: ${subChecked}; label: "${subName}"` };
    });

    await c.check("'Assign this role to:' people picker, Create and Discard buttons", async () => {
      const t = await dialog(page).innerText();
      const ok = t.includes("Assign this role to:") && t.includes("Name, email or group");
      const create = await dialog(page).getByRole("button", { name: "Create", exact: true }).isVisible().catch(() => false);
      const discard = await dialog(page).getByRole("button", { name: "Discard", exact: true }).isVisible().catch(() => false);
      return { pass: ok && create && discard, detail: `Assign: ${ok}; Create: ${create}; Discard: ${discard}` };
    });
  },
});
