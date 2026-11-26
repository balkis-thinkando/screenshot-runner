// Lesson:  AUC-1744 - Grant and remove access to Confluence spaces
//          https://community.atlassian.com/learning/lesson/grant-and-remove-access-to-confluence-spaces
// Image:   #2, section "How to configure space permissions to manage users and groups?" (Space settings > Users,
//          the Manage access dialog of a group with its role set to Collaborator and the role's permissions;
//          dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/84muox2yoh606021pm5o74xucaq73u3i.png
// Recipe:  public.screenshot_recipes where asset_id = '84muox2yoh606021pm5o74xucaq73u3i'
// Opens the Users page of the SyncUp space settings, then the row actions of "All Confluence users" (already a
// Collaborator, so no role has to be picked) and its access dialog. Nothing is changed: Done is never clicked.
// The lesson shows a group (site-admins); the closest row with the Collaborator role on the test site is the
// "All Confluence users" user class.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { closePopups, fakePeopleLinks, hideRolesBanner, itemTexts, keepAppIcons, openSpaceSettings, usersTable } from "../lib/b3-conf";

const ROW = "All Confluence users";
const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Collaborator|Viewer|Admin|Custom access/ }).filter({ has: page.getByRole("checkbox") }).last();

runRecipe({
  file: "AUC-1744-2",
  assetId: "84muox2yoh606021pm5o74xucaq73u3i",
  title: "AUC-1744 #2 - Manage access dialog with the Collaborator role",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceSettings(page, s, "members", "Users");
    await usersTable(page).waitFor({ timeout: 30_000 });
    await closePopups(page);
    await hideRolesBanner(page);
    // The "Add new people" tour can sit over the list: use the keyboard rather than a click
    const more = usersTable(page).locator("tbody tr").filter({ hasText: ROW }).first().getByTestId("table-actions-menu");
    await more.focus();
    await page.keyboard.press("Enter");
    const item = page.getByRole("menuitem", { name: /Manage access|Edit access|View access|access/i }).first();
    await item.waitFor({ timeout: 15_000 });
    const label = (await item.innerText()).trim();
    if (/Remove|Delete/i.test(label)) throw new Error(`Row menu item "${label}" would change access: stopped`);
    await item.click();
    await dialog(page).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await keepAppIcons(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await spotlight(page, dialog(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Dialog title 'Manage access' with Give feedback", async () => {
      const t = (await dialog(page).getByRole("heading").first().innerText().catch(() => "")).trim();
      const fb = await dialog(page).getByText(/Give feedback/).first().isVisible().catch(() => false);
      return { pass: t === "Manage access" && fb, detail: `Title: ${t || "none"}; Give feedback: ${fb}` };
    });

    await c.check("Role drop-down set to Collaborator ('Can add and edit content')", async () => {
      const t = await dialog(page).innerText();
      const collab = /Collaborator/.test(t);
      const desc = /Can add and edit content/i.test(t);
      return { pass: collab && desc, detail: `Collaborator: ${collab}; description: ${desc}` };
    });

    await c.check("Permission groups: Admin, General, Archive and delete, User access, External access, Create and edit", async () => {
      const t = await dialog(page).innerText();
      const want = ["Admin", "General", "Archive and delete", "User access", "External access", "Create and edit"];
      const missing = want.filter((w) => !new RegExp(`(^|\\n)\\s*${w}\\s*(\\n|$)`).test(t));
      // Group headings now: short lines that are not a permission label, the title or a button
      const labels = new Set(await itemTexts(dialog(page).locator("label")));
      const other = /^(Manage access|Role|Collaborator|Can add and edit content|Cancel|Done|All Confluence users|User class|Viewer|Admin|More options|Close Modal|Close)$/;
      const now = t.split("\n").map((l) => l.trim()).filter((l) => l && l.length < 30 && !labels.has(l) && !other.test(l));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}. Groups now: ${now.join(", ")}` : "All present" };
    });

    await c.check("Permissions as checkboxes", async () => {
      const n = await dialog(page).getByRole("checkbox").count();
      const labels = await itemTexts(dialog(page).locator("label"));
      return { pass: n >= 20, detail: `${n} checkboxes (e.g. ${labels.slice(0, 4).join(", ")})` };
    });

    await c.check("Cancel and Done buttons", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible().catch(() => false);
      const done = await dialog(page).getByRole("button", { name: "Done" }).isVisible().catch(() => false);
      return { pass: cancel && done, detail: `Cancel: ${cancel}; Done: ${done}` };
    });
  },
});
