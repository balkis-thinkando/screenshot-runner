// Lesson:  AUC-1424 - Use page templates in your Confluence space
//          https://community.atlassian.com/learning/lesson/use-page-templates-in-your-confluence-space
// Image:   #6, section "Promote or disable templates in your space" (Space settings > Templates: User created
//          templates with one template, Blueprint templates below; the first blueprint's Promote button outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/8xlb14m7pf7633l4i856dgebf5uhpw2n.png
// Recipe:  public.screenshot_recipes where asset_id = '8xlb14m7pf7633l4i856dgebf5uhpw2n'
// Opens the Templates page of the SyncUp space settings (the lesson uses a Marketing space). Nothing is promoted
// or toggled. Test data: SyncUp has no space template of its own (24 Nov 2026), so the "Release readiness
// digest" row of the lesson is a display-only fake (fake person, fixed date) and the check reports it.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { blueprintTable, dimAreas, fakeUserTemplateRow, heading, openTemplates, userTemplatesTable } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent");
const firstPromote = (page: Page) => blueprintTable(page).getByRole("button", { name: /^Promote/ }).first();

runRecipe({
  file: "AUC-1424-6",
  assetId: "8xlb14m7pf7633l4i856dgebf5uhpw2n",
  title: "AUC-1424 #6 - Templates page Promote button",
  product: "confluence",

  async navigate(page, s) {
    await openTemplates(page, s);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakeUserTemplateRow(page, FAKE_PEOPLE[0]);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await dimAreas(page, [firstPromote(page)]);
    await page.mouse.move(1279, 799);
  },

  // Blueprints listed depend on the site's apps
  mask: (page) => [blueprintTable(page).locator("tbody")],

  async checks(page, c) {
    await c.check("Templates, User created templates and Blueprint templates headings", async () => {
      const hs = [];
      for (const h of ["Templates", "User created templates", "Blueprint templates"]) hs.push(`${h}: ${await heading(page, h).isVisible()}`);
      return { pass: !hs.some((h) => h.endsWith("false")), detail: hs.join("; ") };
    });

    await c.check("Create a new template and Open template browser buttons", async () => {
      const create = await main(page).getByRole("button", { name: "Create a new template" }).or(main(page).getByRole("link", { name: "Create a new template" })).first().isVisible();
      const browse = await main(page).getByRole("button", { name: "Open template browser" }).or(main(page).getByRole("link", { name: "Open template browser" })).first().isVisible();
      return { pass: create && browse, detail: `Create a new template: ${create}; Open template browser: ${browse}` };
    });

    await c.check("User created templates columns: Title, Description, Last updated by, Updated, Actions", async () => {
      const heads = (await userTemplatesTable(page).locator("th").allInnerTexts()).map((t) => t.trim());
      const want = ["Title", "Description", "Last updated by", "Updated", "Actions"];
      const missing = want.filter((w) => !heads.includes(w));
      return { pass: !missing.length, detail: `Columns: ${heads.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("A space template is listed (test data)", async () => {
      const real = await userTemplatesTable(page).locator("tbody tr:not([data-screenshot-tweak])").filter({ hasNotText: /no templates specific/ }).count();
      return { pass: real > 0, detail: real ? `${real} templates` : "No space template in SyncUp: needs test data (the row in the capture is a display-only fake)" };
    });

    await c.check("Blueprint rows: toggle and Promote button", async () => {
      const toggles = await blueprintTable(page).locator('input[type="checkbox"]').count();
      const promotes = await blueprintTable(page).getByRole("button", { name: /^Promote/ }).count();
      const what = await main(page).getByRole("link", { name: /What are blueprints/ }).first().isVisible();
      return { pass: toggles > 3 && promotes > 3 && what, detail: `${toggles} toggles, ${promotes} Promote buttons; What are blueprints? link: ${what}` };
    });
  },
});
