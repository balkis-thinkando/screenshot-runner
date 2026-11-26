// Lesson:  AUC-703 - Build simple automation flows
//          https://community.atlassian.com/learning/lesson/build-simple-automation-rules
// Image:   #1, section "Create automation flows from templates" (Jira global automation, Templates tab, Rovo AI
//          Agents templates; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/rmwv4di6xvfoi3x567886p21wop3fk58.png
// Recipe:  public.screenshot_recipes where asset_id = 'rmwv4di6xvfoi3x567886p21wop3fk58'
// Opens Jira admin settings > System > Global automation > Templates. No template is opened.

import { runRecipe } from "../lib/recipe";
import { basicTweaks, firstTemplateCategory, openAutomationTemplates, templatesTabChecks } from "../lib/b3-jreports";

// The lesson's first six Rovo AI Agents templates
const LESSON_TEMPLATES = [
  "Use Rovo Agent to triage bugs in Jira",
  "Use Rovo Agent to assess work readiness in Jira",
  "Use Rovo agent to send Jira project summary to Slack",
  "Use Rovo agent to create Jira project summary page in Confluence",
  "When a major incident closes",
  "When an incident is created '→' suggest resolution steps",
];

runRecipe({
  file: "AUC-703-1",
  assetId: "rmwv4di6xvfoi3x567886p21wop3fk58",
  title: "AUC-703 #1 - Jira global automation templates",
  product: "jira",

  async navigate(page, s) {
    await openAutomationTemplates(page, s, "/jira/settings/automation", "Jira global automation");
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Sidebar 'Jira admin settings', System settings, Global automation", async () => {
      const text = await page.locator('[data-testid="page-layout.sidebar"]').innerText().catch(() => "");
      const missing = ["Jira admin settings", "System", "Global automation"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await templatesTabChecks(page, c);

    await c.check("First category 'Rovo AI Agents' with the lesson's templates", async () => {
      const { heading, cards } = await firstTemplateCategory(page);
      const missing = LESSON_TEMPLATES.filter((t) => !cards.some((c) => c.includes(t)));
      const first = cards.slice(0, 3).map((c) => c.slice(0, 50));
      return {
        pass: heading === "Rovo AI Agents" && !missing.length,
        detail: `Heading: "${heading}"; ${cards.length} cards${missing.length ? `; missing: ${missing.join(" | ")}` : ""}; first: ${first.join(" | ")}`,
      };
    });
  },
});
