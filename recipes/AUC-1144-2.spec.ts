// Lesson:  AUC-1144 - Navigate Assets
//          https://community.atlassian.com/learning/lesson/navigate-assets-in-jira-service-management
// Image:   #2, section "Putting it all together" (People object Ellie Singh: breadcrumbs, Overview / Linked work / Activity tabs, Details attributes, Linked objects panel with Outbound references; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT1ICSJ.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT1ICSJ'
// Opens the People object A_PEOP-3 (named after a site account; shown as the lesson's "Ellie Singh", display only).
// Test data: its attributes are mostly empty and it has an inbound reference (a laptop), no outbound ones.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkTexts, hideAssetsBanners, jsmTweaks, mainArea, openSchema, openAndWait, settle, textOf, treeItem, HARDWARE_SCHEMA, PEOPLE_SCHEMA, PEOPLE_OBJECT, LESSON_PERSON, setTexts, fakeSiteUsers } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const DETAILS = ["Key", "Created", "Updated", "Name", "Username", "Employee ID", "Priority support", "Contact number", "Email address", "User status", "User type", "Department", "Primary location"];

runRecipe({
  file: "AUC-1144-2",
  assetId: "AT1ICSJ",
  title: "AUC-1144 #2 - Assets person object details",
  product: "jira",

  navigate: (page, s) => openAndWait(page, s, `/jira/assets/object/${PEOPLE_OBJECT.id}`, (p) => p.getByText("Linked objects")),

  async tweak(page, s) {
    await hideAssetsBanners(page);
    await jsmTweaks(page, s);
    // The object's name is a site account's name: show the lesson's sample person instead
    const h = page.locator("h1").first();
    const shown = await textOf(h);
    if (shown) await setTexts(page.locator("body"), shown, LESSON_PERSON);
  },

  mask: (page) => [page.getByText(/\b\d{4}, \d{1,2}:\d{2}/)],

  async checks(page, c) {
    await checkTexts(c, "Breadcrumbs Assets / Schemas / People and the object key", page, ["Assets", "Schemas", "People", PEOPLE_OBJECT.key], mainArea(page));
    await c.check("Tabs: Overview, Linked work, Activity", async () => {
      const missing: string[] = [];
      for (const t of ["Overview", "Linked work", "Activity"]) if (!(await page.getByRole("tab", { name: t }).first().isVisible().catch(() => false))) missing.push(t);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
    await checkTexts(c, `Details: ${DETAILS.join(", ")}`, page, DETAILS, mainArea(page));
    await checkTexts(c, "Linked objects panel with Object graph button; Attachments", page, ["Linked objects", "Object graph", "Attachments"], mainArea(page));
    await c.check("Outbound references (Member of, Works at, Managed by)", async () => {
      const text = await textOf(mainArea(page));
      const out = text.includes("Outbound references");
      return { pass: out, detail: out ? "Present" : `Test data: the object has ${text.includes("Inbound references") ? "only inbound references" : "no references"}; its Department, Location and Manager are empty` };
    });
  },
});
