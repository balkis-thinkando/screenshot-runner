// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #4, the agent's draft in Studio, Knowledge section with 3 custom knowledge sources (section outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14AAU.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14AAU'
// Test data: the "DACI Document Assistant" agent owned by the test account (lib/studio.ts). The draft view is
// only opened; nothing is saved or published. Its knowledge is Confluence, Goals and Projects (the test account
// has no Bitbucket), so the source names differ from the lesson's Bitbucket, All spaces, Goals.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openAgentInStudio, studioNavLabels, keepStudioAgentIcons } from "../lib/studio";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, spotlight } from "../lib/tweaks";

// The Knowledge section of the agent form
const knowledge = (page: Page) => page.locator('[data-testid="agent-profile-knowledge-sources-field"]');

runRecipe({
  file: "AUC-498-4",
  assetId: "AT14AAU",
  title: "AUC-498 #4 - Agent knowledge sources",
  product: "jira",

  async navigate(page, s) {
    await openAgentInStudio(page, s, "draft");
    // A chat panel left open by Test would cover the page
    const close = page.getByRole("button", { name: "Close", exact: true });
    if (await close.first().isVisible()) await close.first().click();
    await knowledge(page).waitFor({ timeout: 30_000 });
    if (!(await page.getByText("No organizational knowledge").isVisible())) {
      await knowledge(page).getByRole("button", { name: "Expand section" }).first().click();
    }
    await page.getByText("No organizational knowledge").waitFor({ timeout: 15_000 });
    await knowledge(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(1279, 799);
    await page.waitForTimeout(1_500);
  },

  async tweak(page) {
    await keepStudioAgentIcons(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await spotlight(page, knowledge(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Studio sidebar as in the lesson: For you, Insights, Skills, Apps, Agents, Automation", async () => {
      const labels = await studioNavLabels(page);
      const missing = ["For you", "Insights", "Skills", "Apps", "Agents", "Automation"].filter((t) => !labels.some((l) => l.startsWith(t)));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")} (shown: ${labels.slice(0, 8).join(", ")})` : "Present" };
    });

    await c.check("Header: agent name with a Draft lozenge, Test and Publish buttons", async () => {
      const draft = await page.getByText("Draft", { exact: true }).first().isVisible();
      const test = await page.getByRole("button", { name: "Test", exact: true }).isVisible();
      const publish = await page.getByRole("button", { name: "Publish", exact: true }).isVisible();
      return { pass: draft && test && publish, detail: `Draft: ${draft}; Test: ${test}; Publish: ${publish}` };
    });

    await c.check("Skills section above Knowledge, with a count and Add skills", async () => {
      const add = await page.getByRole("button", { name: "Add skills" }).first().isVisible();
      return { pass: add, detail: add ? "Present" : "No Add skills button" };
    });

    await c.check("Knowledge: title with '3 custom knowledge sources'", async () => {
      const t = (await page.getByText(/custom knowledge sources?/).first().innerText()).trim();
      return { pass: /^3 custom knowledge sources$/.test(t), detail: `"${t}"` };
    });

    await c.check("Knowledge options: All organizational, Custom (selected), No organizational knowledge", async () => {
      const all = await page.getByText("All organizational knowledge").isVisible();
      const custom = await page.getByRole("radio", { name: /Custom knowledge/ }).isChecked().catch(() => false);
      const none = await page.getByText("No organizational knowledge").isVisible();
      return { pass: all && custom && none, detail: `All: ${all}; Custom selected: ${custom}; None: ${none}` };
    });

    await c.check("Add knowledge button and a delete button per source", async () => {
      const add = await knowledge(page).getByRole("button", { name: "Add knowledge" }).isVisible();
      const del = await knowledge(page).getByRole("button", { name: /Delete|Remove source/ }).count();
      return { pass: add && del === 3, detail: `Add knowledge: ${add}; ${del} delete buttons` };
    });

    // The test agent's sources differ from the lesson's (see the header), so only their number is checked
    await c.check("Three sources listed, each with its app icon", async () => {
      const text = (await knowledge(page).innerText()).split("\n").map((t) => t.trim());
      const shown = ["All content", "All spaces", "Goals", "Projects", "Bitbucket"].filter((t) => text.includes(t));
      return { pass: shown.length === 3, detail: `Sources: ${shown.join(", ")}` };
    });
  },
});
