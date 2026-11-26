// Lesson:  AUC-1744 - Grant and remove access to Confluence spaces
//          https://community.atlassian.com/learning/lesson/grant-and-remove-access-to-confluence-spaces
// Image:   #1, section "How to configure space permissions to manage users and groups?" (Space settings > Users:
//          the Users link and the people and groups list with roles outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14Q9P.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q9P'
// Opens the Users page of the SyncUp space settings (the lesson uses an Employee Onboarding space). Nothing is
// changed. The "Your site now uses roles" banner and the "Add new people" tour are hidden display-only. Which
// users, groups and apps have access depends on the site, so the list rows are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { closePopups, dimAreas, fakePeopleLinks, heading, hideRolesBanner, itemTexts, keepAppIcons, missingFrom, navLink, openSpaceSettings, usersTable } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent");

runRecipe({
  file: "AUC-1744-1",
  assetId: "AT14Q9P",
  title: "AUC-1744 #1 - Space settings Users list",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceSettings(page, s, "members", "Users");
    await usersTable(page).waitFor({ timeout: 30_000 });
    await closePopups(page);
  },

  async tweak(page, s) {
    await hideRolesBanner(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await keepAppIcons(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await dimAreas(page, [navLink(page, "Users"), [heading(page, "Users"), usersTable(page)]]);
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [usersTable(page).locator("tbody")],

  async checks(page, c) {
    await c.check("Users heading with Give feedback and more actions", async () => {
      const h = await heading(page, "Users").isVisible();
      const fb = await main(page).getByRole("button", { name: /Give feedback/ }).first().isVisible().catch(() => false);
      return { pass: h && fb, detail: `Users heading: ${h}; Give feedback: ${fb}` };
    });

    await c.check("Search box, Type and Role filters, Add people button", async () => {
      const search = await main(page).getByRole("combobox").or(main(page).getByRole("textbox")).or(main(page).getByText(/^Search who has access/)).first().isVisible().catch(() => false);
      const buttons = await itemTexts(main(page).getByRole("button"));
      const type = buttons.some((b) => /^(Type|User type)$/.test(b));
      const role = buttons.includes("Role");
      const add = buttons.find((b) => /^Add people/.test(b));
      return {
        pass: search && type && role && add === "Add people",
        detail: `Search: ${search}; Type filter: ${type}${buttons.includes("User type") ? " (now 'User type')" : ""}; Role filter: ${role}; add button: ${add ?? "missing"}`,
      };
    });

    await c.check("List columns: People in this space, Type, Role", async () => {
      const heads = await itemTexts(usersTable(page).locator("th"));
      const missing = missingFrom(heads, ["People in this space", "Type", "Role"]);
      return { pass: !missing.length, detail: `Columns: ${heads.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")} (the type now shows under each name)` : ""}` };
    });

    await c.check("Rows with a role drop-down and a more actions button", async () => {
      const rows = await usersTable(page).locator("tbody tr").count();
      const roles = await usersTable(page).locator("tbody tr").filter({ hasText: /Viewer|Collaborator|Admin|Custom access/ }).count();
      return { pass: rows >= 3 && roles >= 3, detail: `${rows} rows, ${roles} with a role` };
    });

    await c.check("Sidebar: Users link next to Mission control and Automation", async () => {
      const links = await itemTexts(page.locator("#side-navigation").getByRole("link"));
      const missing = missingFrom(links, ["Mission control", "Automation", "Users", "Content manager", "Space details", "Analytics"]);
      return { pass: !missing.length, detail: `Links: ${links.slice(0, 8).join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });
  },
});
