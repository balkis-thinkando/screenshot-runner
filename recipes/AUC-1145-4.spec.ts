// Lesson:  AUC-1145 - Create Assets object types and attributes
//          https://community.atlassian.com/learning/lesson/create-assets-object-types-and-attributes
// Image:   #4, section "How do you create objects?" (IT Hardware parent object type with no objects: 'There are no objects to display' and the 'Create an object' button outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/765aw100qic4ml33ts8008jw0i5xsi2x.png
// Recipe:  public.screenshot_recipes where asset_id = '765aw100qic4ml33ts8008jw0i5xsi2x'
// Opens the Hardware assets schema (A_HA, stand-in for IT Employee Assets) at the Physical server object type, which
// has no objects (its parent Infrastructure is abstract, so it shows no Create button), and outlines the Create an object button. Nothing is created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const createObject = (page: Page) => page.getByRole("button", { name: /Create an? object|Create object/ }).first();

runRecipe({
  file: "AUC-1145-4",
  assetId: "765aw100qic4ml33ts8008jw0i5xsi2x",
  title: "AUC-1145 #4 - Create an object in an empty object type",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, HARDWARE_SCHEMA, 49);
    await createObject(page).waitFor({ timeout: 30_000 }).catch(() => {});
    await settle(page);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    if (await createObject(page).isVisible().catch(() => false)) await outline(page, createObject(page));
  },

  async checks(page, c) {
    await c.check("Empty state 'There are no objects to display'", async () => {
      const text = await textOf(page.locator("body"));
      const pass = /no objects to display/i.test(text);
      return { pass, detail: pass ? "Present" : `Empty state text: "${text.split("\n").find((l) => /object/i.test(l))?.slice(0, 120) ?? "none"}"` };
    });
    await c.check("'Create an object' button", async () => {
      const b = createObject(page);
      const v = await b.isVisible().catch(() => false);
      return { pass: v && (await textOf(b)) === "Create an object", detail: v ? `"${await textOf(b)}"` : "Missing" };
    });
    await checkTexts(c, "Object type 'Physical server' open with Objects / Attributes", page, ["Physical server", "Objects", "Attributes"]);
    await checkTexts(c, "Schema tree with nested types", page, ["SCHEMA TREE", "Hardware", "Infrastructure", "Physical server"]);
  },
});
