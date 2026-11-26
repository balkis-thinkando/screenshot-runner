// Lesson:  AUC-1145 - Create Assets object types and attributes
//          https://community.atlassian.com/learning/lesson/create-assets-object-types-and-attributes
// Image:   #1, section "How do you create an object type?" (IT Employee Assets schema, Laptops object type with its objects; the '+' (add object type) button of the schema tree outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/u3300pj36o275by0psi7f21oi50p0566.png
// Recipe:  public.screenshot_recipes where asset_id = 'u3300pj36o275by0psi7f21oi50p0566'
// Opens the Hardware assets schema (A_HA, stand-in for IT Employee Assets) at its Laptop object type and outlines
// the schema tree's Add object type button. Nothing is created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, checkButtons, showObjectTable, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const addType = (page: Page) => page.getByRole("button", { name: /Add object type/ }).first();

runRecipe({
  file: "AUC-1145-1",
  assetId: "u3300pj36o275by0psi7f21oi50p0566",
  title: "AUC-1145 #1 - Add object type button in the schema tree",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, HARDWARE_SCHEMA, 43, true);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    await outline(page, addType(page));
  },

  async checks(page, c) {
    await c.check("Schema tree 'Add object type' (+) button", async () => {
      const v = await addType(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await checkTexts(c, "SCHEMA TREE with nested object types (Hardware, End user compute, Laptop)", page, ["SCHEMA TREE", "Hardware", "End user compute", "Laptop"]);
    await c.check("Object type 'Laptop' open with Objects / Attributes", async () => {
      const text = await textOf(mainArea(page));
      const pass = text.includes("Laptop") && text.includes("Objects") && text.includes("Attributes");
      return { pass, detail: pass ? "Present" : `Main area starts: "${text.slice(0, 80).replace(/\n/g, " ")}"` };
    });
    await checkButtons(c, "List toolbar: Bulk actions, Filter", page, ["Bulk actions", "Filter"], mainArea(page));
    await c.check("Objects listed (lesson: 29 laptops)", async () => {
      const m = /(\d+) objects?/i.exec(await textOf(mainArea(page)));
      const n = m ? Number(m[1]) : 0;
      return { pass: n > 0, detail: m ? `${n} objects` : "No object count shown" };
    });
  },
});
