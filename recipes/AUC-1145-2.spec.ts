// Lesson:  AUC-1145 - Create Assets object types and attributes
//          https://community.atlassian.com/learning/lesson/create-assets-object-types-and-attributes
// Image:   #2, section "Create and configure attributes" (Supported monitors object type, Attributes tab: attribute table (Name, Description, Type, Type Value...) and the empty add-attribute row outlined, Attributes switch outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/hm50nuna02n824183783rq7y0x256410.png
// Recipe:  public.screenshot_recipes where asset_id = 'hm50nuna02n824183783rq7y0x256410'
// Opens the Hardware assets schema (A_HA, stand-in for IT Employee Assets) at the Monitor object type and switches
// to Attributes. Outlines the Attributes switch and the empty add-attribute row. Nothing is added.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, viewMode, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const attrTab = (page: Page) => viewMode(page, "Attributes");
const addRow = (page: Page) => page.locator("[data-b3-addrow]");

/** Marks the add-attribute row: the smallest ancestor of the Add button holding the new attribute's inputs. */
async function markAddRow(page: Page) {
  await page.getByRole("button", { name: /^Add$/ }).first().evaluate((b) => {
    for (let a = b.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.querySelectorAll("input, [role=combobox], button").length >= 3) return a.setAttribute("data-b3-addrow", "");
    }
  }).catch(() => {});
}

runRecipe({
  file: "AUC-1145-2",
  assetId: "hm50nuna02n824183783rq7y0x256410",
  title: "AUC-1145 #2 - Object type attributes with new attribute row",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, HARDWARE_SCHEMA, 40);
    await attrTab(page).click();
    await page.getByText("Type Value").or(page.getByText("Type value")).first().waitFor({ timeout: 30_000 });
    await settle(page);
    // The add-attribute row is under the last attribute
    await page.getByRole("button", { name: /^Add$/ }).first().scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => {});
    // The table is wider than the window: scroll it back to its first column, as in the lesson
    await page.getByRole("button", { name: /^Add$/ }).first().evaluate((b) => {
      for (let a = b.parentElement; a; a = a.parentElement) if (a.scrollWidth > a.clientWidth) a.scrollLeft = 0;
    }).catch(() => {});
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    await markAddRow(page);
    const areas = [attrTab(page)];
    if (await addRow(page).isVisible().catch(() => false)) areas.push(addRow(page));
    await spotlightAreas(page, await visibleAreas(areas));
  },

  async checks(page, c) {
    await checkTexts(c, "Columns: Reorder, Label, Name, Description, Type, Type Value, Additional Value, ID, Actions", page, ["Name", "Description", "Type", "Additional Value", "ID", "Actions"], mainArea(page));
    await checkTexts(c, "Default attributes Key, Name, Created, Updated", page, ["Key", "Name", "Created", "Updated"], mainArea(page));
    await c.check("Empty add-attribute row (name, description, type, type value, Add)", async () => {
      await markAddRow(page);
      const v = await addRow(page).isVisible().catch(() => false);
      const inputs = v ? await addRow(page).locator("input, [role=combobox]").count() : 0;
      return { pass: v && inputs >= 2, detail: v ? `${inputs} inputs` : "Missing" };
    });
    await checkControl2(page, c);
  },
});

async function checkControl2(page: Page, c: import("../lib/recipe").Checks) {
  await c.check("'Add parent attributes' button", async () => {
    const v = await page.getByRole("button", { name: /Add parent attributes/ }).first().isVisible().catch(() => false);
    return { pass: v, detail: v ? "Present" : "UI change: no 'Add parent attributes' button under the attributes of a child type (Monitor)" };
  });
}
