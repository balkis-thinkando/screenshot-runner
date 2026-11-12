// Lesson:  AUC-1835 — Manage global automation settings
//          https://community.atlassian.com/learning/lesson/manage-confluence-jira-global-automation-settings
// Image:   #1, section "Manage automation globally" (base image of the labelled graphic
//          "0259_globalautomationlabeledgraphic")
//          https://dam-cdn.atl.orangelogic.com/AssetLink/jea1221he3x74yv7qkclj63yd1y828mh.png
// Recipe:  public.screenshot_recipes where asset_id = 'jea1221he3x74yv7qkclj63yd1y828mh'

import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, fakeNames, fakePeople, markers, spotlightAreas } from "../lib/tweaks";

// Owners as in the lesson (Mitch Davis is a real account on the training site, so not him)
const JIRA_PEOPLE = fakePeople("Emma Rose", "Kevin Campbell");
const LESSON_MENU = ["View performance insights", "Automation service status", "Import flows", "Export flows", "Transfer User", "Global configuration", "Configure steps"];
const moreActions = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "More actions", exact: true }).first();
// The Flows tab row (the Global/Studio switcher is a separate tab list)
const flowTabs = (page: import("@playwright/test").Page) =>
  page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "Flows", exact: true }) }).first().getByRole("tab");

runRecipe({
  file: "AUC-1835-1",
  assetId: "jea1221he3x74yv7qkclj63yd1y828mh",
  title: "AUC-1835 #1 — Jira global automation tabs and More actions menu",
  product: "jira",

  async navigate(page, s) {
    // Settings (gear) > System > Global automation
    await openSignedIn(page, s, "/jira/settings/automation");
    await page.locator("h1", { hasText: "Automation" }).waitFor({ timeout: 60_000 });
    await page.getByRole("tab", { name: "Flows" }).first().waitFor();
    await page.waitForTimeout(3_000);
    // "Exciting changes have come to automation" and similar tours
    const close = page.getByRole("dialog").getByRole("button", { name: "Close", exact: true });
    if (await close.first().isVisible().catch(() => false)) await close.first().click();
    await page.getByRole("dialog").first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  },

  async tweak(page) {
    // Names first: anonymize() then turns the avatars into initials
    await fakeNames(page, "Owner", JIRA_PEOPLE);
    await anonymize(page, "AU", JIRA_PEOPLE);
    // Open the More actions menu, as in the lesson
    await moreActions(page).click();
    const items = page.getByRole("menuitem");
    await items.first().waitFor();
    await page.waitForTimeout(1_000); // let the menu finish opening before measuring it
    const tabs = flowTabs(page);
    // Three outlined areas: the tab row, the More actions button and the open menu
    await spotlightAreas(page, [[tabs.first(), tabs.last()], moreActions(page), [items.first(), items.last()]]);
    await markers(page, tabs, "down", [150]);
    await markers(page, items, "left", [210, 150]);
  },

  // Flow names, owners, dates and on/off states change; compare the page frame, tabs and menu
  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Page title reads 'Automation' with a Create flow button", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const create = await page.getByRole("button", { name: /Create flow/ }).first().isVisible();
      return { pass: h1 === "Automation" && create, detail: `"${h1}", Create flow ${create ? "present" : "missing"}` };
    });

    await c.check("Tabs: Flows, Audit log, Templates, Usage", async () => {
      const tabs = (await flowTabs(page).allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const pass = JSON.stringify(tabs) === JSON.stringify(["Flows", "Audit log", "Templates", "Usage"]);
      return { pass, detail: `Tabs: ${tabs.join(", ")}` };
    });

    await c.check(`More actions menu: ${LESSON_MENU.join(", ")}`, async () => {
      const items = (await page.getByRole("menuitem").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const pass = JSON.stringify(items) === JSON.stringify(LESSON_MENU);
      const added = items.filter((t) => !LESSON_MENU.includes(t));
      const removed = LESSON_MENU.filter((t) => !items.includes(t));
      return { pass, detail: pass ? "Same items, same order" : `Now: ${items.join(", ")}. Added: ${added.join(", ") || "none"}. Removed or renamed: ${removed.join(", ") || "none"}.` };
    });
  },
});
