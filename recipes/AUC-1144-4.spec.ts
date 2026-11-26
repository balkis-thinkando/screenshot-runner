// Lesson:  AUC-1144 - Navigate Assets
//          https://community.atlassian.com/learning/lesson/navigate-assets-in-jira-service-management
// Image:   #4, section "Object schema related actions" (Schema graph dialog over the People schema: View: All object types, graph with Department, People, Cost center, People attributes panel; dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT1ICSK.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1ICSK'
// Opens the People schema (A_PEOP) and clicks Schema graph. Nothing is edited.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: "Schema graph" }).first();

runRecipe({
  file: "AUC-1144-4",
  assetId: "AT1ICSK",
  title: "AUC-1144 #4 - Assets schema graph",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, PEOPLE_SCHEMA);
    await page.getByRole("button", { name: /Schema graph/ }).first().click();
    await dialog(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    await outline(page, dialog(page));
  },

  async checks(page, c) {
    await c.check("Dialog 'Schema graph' with close button", async () => {
      const v = await dialog(page).isVisible().catch(() => false);
      const close = await dialog(page).getByRole("button", { name: /Close/ }).first().isVisible().catch(() => false);
      return { pass: v && close, detail: `Dialog: ${v}; close: ${close}` };
    });
    await checkTexts(c, "View: All object types", page, ["View", "All object types"], dialog(page));
    await c.check("Graph shows People, Department, Cost center", async () => {
      const text = await textOf(dialog(page));
      const missing = ["People", "Department", "Cost center"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Test data: object types missing from the site's People schema: ${missing.join(", ")}` : "All present" };
    });
    await checkTexts(c, "Side panel: Go to object type, Attributes (Key, Created, Updated, Name)", page, ["Go to object type", "Attributes", "Key", "Created", "Updated", "Name"], dialog(page));
  },
});
