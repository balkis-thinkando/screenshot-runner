// Lesson:  AUC-703 - Build simple automation flows
//          https://community.atlassian.com/learning/lesson/build-simple-automation-rules
// Image:   #2, section "Create automation flows from templates" (Confluence administration automation, Templates tab,
//          Organize templates; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/y278j43b44t1qw7etxid2yj68s04mvd8.png
// Recipe:  public.screenshot_recipes where asset_id = 'y278j43b44t1qw7etxid2yj68s04mvd8'
// Opens Confluence administration > Automation > Templates. No template is opened. The green "Automate any task"
// banner above the templates (not in the lesson) is hidden.

import { runRecipe } from "../lib/recipe";
import { basicTweaks, firstTemplateCategory, openAutomationTemplates, templatesTabChecks } from "../lib/b3-jreports";

const LESSON_TEMPLATES = [
  "Send an email with a Rovo-generated summary and action items when a meeting notes page is published",
  "Add specific labels when a page is published by a certain author",
  "Change page owner when scheduled for pages with deactivated accounts",
  "When a page is published use Rovo to determine the best label to add",
  "Create smart link for Loom when a page is published",
  "Archive inactive pages when scheduled (recurring)",
];

runRecipe({
  file: "AUC-703-2",
  assetId: "y278j43b44t1qw7etxid2yj68s04mvd8",
  title: "AUC-703 #2 - Confluence automation templates",
  product: "jira",

  async navigate(page, s) {
    await openAutomationTemplates(page, s, "/wiki/admin/automation", "Confluence administration automation");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Sidebar 'Confluence administration' with Admin tools > Automation", async () => {
      const body = await page.locator("body").innerText();
      const missing = ["Confluence administration", "Monitoring", "Admin tools", "Automation"].filter((t) => !body.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await templatesTabChecks(page, c);

    await c.check("First category 'Organize' with the lesson's six templates", async () => {
      const { heading, cards } = await firstTemplateCategory(page);
      const missing = LESSON_TEMPLATES.filter((t) => !cards.some((c) => c.includes(t)));
      return { pass: heading === "Organize" && !missing.length, detail: `Heading: "${heading}"; ${cards.length} cards${missing.length ? `; missing: ${missing.join(" | ")}` : ""}` };
    });
  },
});
