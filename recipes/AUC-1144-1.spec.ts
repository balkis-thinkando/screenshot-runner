// Lesson:  AUC-1144 - Navigate Assets
//          https://community.atlassian.com/learning/lesson/navigate-assets-in-jira-service-management
// Image:   #1, section "Putting it all together" (Assets Schemas list with the top search dropdown open for a person's name: Schema and Object type filters, one People object result; dropdown outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT1ICSI.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1ICSI'
// Opens Assets > Schemas and types the name of the People object A_PEOP-3 into the top search box (nothing is opened). The lesson types
// the person's name; the recipe types the object key so a site account's name is never typed.
// The object is named after a site account, so its name becomes the lesson's "Ellie Singh" (display only).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers, hideTip, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const dropdown = (page: Page) => page.locator('[data-testid="search-dialog"]').or(page.getByRole("dialog")).first();

runRecipe({
  file: "AUC-1144-1",
  assetId: "AT1ICSI",
  title: "AUC-1144 #1 - Assets search for a person object",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/assets/schemas", (p) => p.getByText(/Showing \d+ of \d+ schemas/));
    await page.locator('[data-testid="atlassian-navigation.ui.search.quickfind-skeleton-wrapper"]').or(page.getByRole("button", { name: /^Search/ })).or(page.getByPlaceholder("Search")).first().click();
    await page.keyboard.type(PEOPLE_OBJECT.key);
    await dropdown(page).getByText(PEOPLE_OBJECT.key).first().waitFor({ timeout: 30_000 });
    await settle(page, 2_500);
  },

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await hideTip(page, "Rovo tip");
    // The People object is named after a site account: show the lesson's sample person
    await fakeSiteUsers(page, [LESSON_PERSON]);
    await jsmTweaks(page, s);
    await outline(page, dropdown(page));
  },

  mask: (page) => [page.getByText(/^Updated /)],

  async checks(page, c) {
    await c.check("Search dropdown open with Schema and Object type filters", async () => {
      const text = await textOf(dropdown(page));
      const missing = ["Schema", "Object type"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
    await c.check("A People object result ('Assets • Object • People')", async () => {
      const text = (await textOf(dropdown(page))).replace(/\s+/g, " ");
      const pass = text.includes(PEOPLE_OBJECT.key) && /Assets\s*•\s*Object\s*•\s*People/.test(text);
      return { pass, detail: pass ? "Present" : `Result text: "${text.slice(0, 160)}"` };
    });
    await checkTexts(c, "'SEARCH RESULTS' heading, 'Search all apps', 'Help us improve search', 'Give feedback'", page, ["Search all apps", "Help us improve search", "Give feedback"], dropdown(page));
    await checkTexts(c, "Schemas list: Display name, Schema name, Key, Type, Objects; People schema", page, ["Display name", "Schema name", "Key", "Type", "Objects", "People", "a_people", "A_PEOP"]);
  },
});
