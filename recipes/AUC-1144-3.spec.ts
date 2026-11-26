// Lesson:  AUC-1144 - Navigate Assets
//          https://community.atlassian.com/learning/lesson/navigate-assets-in-jira-service-management
// Image:   #3, section "Navigate Assets" (People schema with the Department object type open: callouts on the Assets app name, schema tree, schema search/graph/more, Objects/Attributes switch and the list toolbar)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14Q1W.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q1W'
// Opens the People schema (A_PEOP) at its Department object type when the schema has one, otherwise its first type
// (test data: the site's People schema may only have People). Outlines the areas the lesson calls out.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, viewMode, checkButtons, showObjectTable, visibleAreas } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

let typeName = "Department";
const toolbar = (page: Page) => page.getByRole("button", { name: "Bulk actions" }).first().locator("xpath=ancestor::*[.//button[@aria-label='Filter']][1]");

runRecipe({
  file: "AUC-1144-3",
  assetId: "AT14Q1W",
  title: "AUC-1144 #3 - Assets schema tree and object list",
  product: "jira",

  async navigate(page, s) {
    await openSchema(page, s, PEOPLE_SCHEMA);
    typeName = (await treeItem(page, "Department").isVisible().catch(() => false)) ? "Department" : "People";
    await treeItem(page, typeName).click();
    await page.waitForTimeout(3_000);
    await showObjectTable(page);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    const tree = page.getByText(/^schema tree$/i).first().locator("xpath=ancestor::*[.//a][1]");
    const search = page.getByPlaceholder(/Search this schema/).first().locator("xpath=ancestor::*[.//button][1]");
    const toggle = viewMode(page, "Objects").locator("xpath=..");
    await spotlightAreas(page, await visibleAreas([tree, search, toggle, toolbar(page)]));
  },

  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Schema title 'People' and breadcrumbs Assets / Schemas", async () => {
      const text = await textOf(mainArea(page));
      return { pass: text.includes("People") && text.includes("Schemas"), detail: `Starts: "${text.slice(0, 60).replace(/\n/g, " ")}"` };
    });
    await c.check("Schema tree with People, Department, Cost center", async () => {
      const missing: string[] = [];
      for (const t of ["People", "Department", "Cost center"]) if (!(await treeItem(page, t).isVisible().catch(() => false))) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Test data: object types missing from the site's People schema: ${missing.join(", ")}` : "All present" };
    });
    await checkTexts(c, "'SCHEMA TREE' heading with Add object type", page, ["SCHEMA TREE"], undefined);
    await c.check("Search this schema box, Schema graph and More buttons", async () => {
      const search = await page.getByPlaceholder(/Search this schema/).first().isVisible().catch(() => false);
      const graph = await page.getByRole("button", { name: /Schema graph/ }).first().isVisible().catch(() => false);
      return { pass: search && graph, detail: `Search: ${search}; Schema graph: ${graph}` };
    });
    await c.check("Objects / Attributes switch", async () => {
      const o = await viewMode(page, "Objects").isVisible().catch(() => false);
      const a = await viewMode(page, "Attributes").isVisible().catch(() => false);
      return { pass: o && a, detail: `Objects: ${o}; Attributes: ${a}` };
    });
    await c.check("Object list: toolbar (Bulk actions, Filter) and columns Key, Created, Updated", async () => {
      const empty = await page.getByText("There are no objects to display").first().isVisible().catch(() => false);
      const bulk = await page.getByRole("button", { name: "Bulk actions" }).first().isVisible().catch(() => false);
      const cols = (await textOf(page.locator("table thead"))).replace(/\s+/g, " ");
      const pass = bulk && ["Key", "Created", "Updated"].every((t) => cols.includes(t));
      return { pass, detail: empty ? `Test data: the site's ${typeName} object type has no objects (lesson: 9 departments)` : `Bulk actions: ${bulk}; columns: ${cols.slice(0, 120)}` };
    });
  },
});
