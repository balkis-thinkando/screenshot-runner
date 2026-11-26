// Lesson:  AUC-1145 - Create Assets object types and attributes
//          https://community.atlassian.com/learning/lesson/create-assets-object-types-and-attributes
// Image:   #3, section "Once you create an attribute, how do you configure it?" (Supported mice object type, Attributes tab, the '...' menu of an Object attribute open (Attribute settings, Delete); menu outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/fhlf1wf7fk0gng872ak1s6rv474qo372.png
// Recipe:  public.screenshot_recipes where asset_id = 'fhlf1wf7fk0gng872ak1s6rv474qo372'
// Opens the Hardware assets schema (A_HA, stand-in for IT Employee Assets) at its root Hardware object type, switches
// to Attributes and opens the "..." menu of the last attribute row (an attribute of the type itself).
// Test data: Hardware assets is a system schema, so its attributes offer Attribute settings only, no Delete. Nothing in the menu is clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, viewMode, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const attrTab = (page: Page) => viewMode(page, "Attributes");
const menu = (page: Page) => page.getByRole("menu").or(page.locator('[role="menuitem"]').first().locator("xpath=..")).first();

runRecipe({
  file: "AUC-1145-3",
  assetId: "fhlf1wf7fk0gng872ak1s6rv474qo372",
  title: "AUC-1145 #3 - Attribute actions menu",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, HARDWARE_SCHEMA, 9);
    await attrTab(page).click();
    await page.getByText("Type Value").or(page.getByText("Type value")).first().waitFor({ timeout: 30_000 });
    await settle(page);
    // The last attribute row's actions button (the lesson opens it on an Object attribute)
    const more = page.locator("table tbody tr").getByRole("button", { name: /more|actions|options/i });
    await more.last().click();
    await menu(page).waitFor({ timeout: 15_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    await outline(page, menu(page));
  },

  async checks(page, c) {
    await c.check("Menu items: Attribute settings, Delete", async () => {
      const items = (await page.getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
      const missing = ["Attribute settings", "Delete"].filter((t) => !items.some((i) => i.includes(t)));
      return { pass: !missing.length, detail: `Items: ${items.join(", ")}${missing.includes("Delete") ? " (test data: the stand-in is a system schema, whose attributes cannot be deleted; the lesson uses a custom schema)" : ""}` };
    });
    await checkTexts(c, "Attributes table: Name, Type, Type Value, Actions", page, ["Name", "Type", "Actions"], mainArea(page));
    await checkTexts(c, "Schema tree beside the table", page, ["SCHEMA TREE", "Hardware", "Peripheral"]);
  },
});
