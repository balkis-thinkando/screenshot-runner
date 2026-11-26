// Lesson:  AUC-938 - Build a knowledge base that meets your customers' needs
//          https://community.atlassian.com/learning/lesson/building-a-knowledge-base
// Image:   #2, section "Manage your templates and blueprints" (Same Templates page; the edit icon of the first blueprint (HR Knowledge Base Management) outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/h135sfuw50lf6c73qf80y2h5rkobk4x2.png
// Recipe:  public.screenshot_recipes where asset_id = 'h135sfuw50lf6c73qf80y2h5rkobk4x2'
// See below. The edit icon is outlined, never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

// Confluence space settings > Look and feel > Templates of the M0064 Meridian Customer Support knowledge base space
// (MKB, stand-in for the lesson's Marketing space). Nothing is edited, promoted or turned off.
const SPACE = "MKB";
const BLUEPRINTS = ["HR Knowledge Base Management", "Team Calendars Blueprint", "Service team health monitor", "ITSM change management", "Product Requirements Blueprint", "Incident postmortem"];
const content = (page: Page) => page.getByRole("heading", { name: "Templates", exact: true }).first().locator("xpath=ancestor::*[.//h2 or .//h3][2]");
const navTemplates = (page: Page) => page.getByRole("link", { name: "Templates", exact: true }).first();
const createTemplate = (page: Page) => page.getByRole("link", { name: "Create a new template" }).or(page.getByRole("button", { name: "Create a new template" })).first();
const firstEdit = (page: Page) => page.locator('a[href*="edit-template.action"]').first();

async function openTemplates(page: Page, s: import("../lib/supabase").Settings) {
  await openAndWait(page, s, `/wiki/spaces/${SPACE}/settings/look-and-feel/templates`, (p) => p.getByText("Blueprint templates"));
  // Expand Look and feel in the settings sidebar, as in the lesson (Templates highlighted)
  if (!(await navTemplates(page).isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Look and feel/ }).or(page.getByText("Look and feel", { exact: true })).first().click().catch(() => {});
    await navTemplates(page).waitFor({ timeout: 10_000 }).catch(() => {});
  }
  await page.mouse.move(1279, 799);
}

async function templateChecks(page: Page, c: import("../lib/recipe").Checks) {
  await checkHeading(c, "Heading 'Templates' in Space settings", page, "Templates");
  await checkTexts(c, "Sections 'User created templates' and 'Blueprint templates', 'What are blueprints?'", page, ["User created templates", "Blueprint templates", "What are blueprints?"]);
  await c.check("Buttons 'Create a new template' and 'Open template browser'", async () => {
    const a = await createTemplate(page).isVisible().catch(() => false);
    const b = await page.getByRole("link", { name: "Open template browser" }).or(page.getByRole("button", { name: "Open template browser" })).first().isVisible().catch(() => false);
    return { pass: a && b, detail: `Create a new template: ${a}; Open template browser: ${b}` };
  });
  await checkTexts(c, `Blueprints listed: ${BLUEPRINTS.join(", ")}`, page, BLUEPRINTS);
  await c.check("Blueprint rows: on/off switch, Promote, edit icon", async () => {
    const promote = await page.getByText("Promote", { exact: true }).count();
    const edit = await page.locator('a[href*="edit-template.action"]').count();
    return { pass: promote > 0 && edit > 0, detail: `Promote: ${promote}; edit links: ${edit}` };
  });
  await c.check("A user created template row (Title, Description, Last updated by, Updated, Actions)", async () => {
    const empty = await page.getByText(/You have no templates specific to this space/).first().isVisible().catch(() => false);
    return { pass: !empty, detail: empty ? "Needs test data: the space has no user created template" : "Present" };
  });
  await checkTexts(c, "Space settings sidebar: Mission control, Automation, Content manager, Space details, Look and feel > Templates", page, ["Mission control", "Automation", "Space details", "Look and feel", "Templates"]);
}

runRecipe({
  file: "AUC-938-2",
  assetId: "h135sfuw50lf6c73qf80y2h5rkobk4x2",
  title: "AUC-938 #2 - Edit a blueprint template",
  product: "jira",

  navigate: (page, s) => openTemplates(page, s),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await outline(page, firstEdit(page));
  },

  async checks(page, c) {
    await c.check("Edit icon on the first blueprint template", async () => {
      const v = await firstEdit(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await templateChecks(page, c);
  },
});
