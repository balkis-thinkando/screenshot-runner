// Lesson:  AUC-498 - Create custom Rovo Agents
//          https://community.atlassian.com/learning/lesson/create-custom-rovo-agents
// Image:   #5, the "Add skills" dialog opened from the agent's draft in Studio (dialog outlined)
//          https://images.ctfassets.net/xkfunaz6zr9g/2EzyrwJJmVkuWoAX4uzBSm/ (asset 0404-skills-for-rovo-agents)
// Recipe:  public.screenshot_recipes where asset_id = '0404-skills-for-rovo-agents'
// Test data: the "DACI Document Assistant" agent owned by the test account (lib/studio.ts). The dialog is only
// opened: no skill is selected and Add is never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openAgentInStudio, keepStudioAgentIcons } from "../lib/studio";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, spotlight } from "../lib/tweaks";

const dialog = (page: Page) => page.getByRole("dialog").last();

runRecipe({
  file: "AUC-498-5",
  assetId: "0404-skills-for-rovo-agents",
  title: "AUC-498 #5 - Add skills dialog",
  product: "jira",

  async navigate(page, s) {
    await openAgentInStudio(page, s, "draft");
    const close = page.getByRole("button", { name: "Close", exact: true });
    if (await close.first().isVisible()) await close.first().click();
    await page.getByRole("button", { name: "Add skills" }).first().click();
    await dialog(page).getByRole("searchbox").or(dialog(page).locator("input")).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_500); // skill cards load after the dialog
    await page.mouse.move(1279, 799);
  },

  async tweak(page) {
    await keepStudioAgentIcons(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await spotlight(page, dialog(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Dialog title 'Add skills'", async () => {
      const h = (await dialog(page).locator("h1, h2, [role=heading]").first().innerText()).trim();
      return { pass: h === "Add skills", detail: `"${h}"` };
    });

    await c.check("Intro: select skills, then reference them in the scenario's instructions", async () => {
      const t = await dialog(page).getByText(/Select skills, then tell your agent how to use them/).first().isVisible();
      return { pass: t, detail: t ? "Same text" : `Text: "${(await dialog(page).innerText()).split("\n").slice(1, 2).join(" ").slice(0, 120)}"` };
    });

    await c.check("Search box 'Search for a skill you want to use'", async () => {
      const box = await dialog(page).getByPlaceholder(/Search for a skill/).isVisible().catch(() => false);
      const any = await dialog(page).locator("input").first().getAttribute("placeholder").catch(() => null);
      return { pass: box, detail: box ? "Same placeholder" : `Placeholder: "${any}"` };
    });

    await c.check("Left list: All skills, Atlassian apps (Jira, Confluence, Jira Service Management...), Connected apps", async () => {
      const text = await dialog(page).innerText();
      const missing = ["All skills", "Atlassian apps", "Jira", "Confluence", "Jira Service Management", "Connected apps"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Skill cards with name, description and a BETA tag on some", async () => {
      const text = await dialog(page).innerText();
      const beta = /\bBETA\b/i.test(text);
      const card = /Add comment to page/.test(text);
      return { pass: beta && card, detail: `BETA tags: ${beta}; 'Add comment to page' card: ${card}` };
    });

    await c.check("Footer: selected count, Cancel and Add", async () => {
      const count = await dialog(page).getByText(/\d+ skills? selected/).first().isVisible();
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible();
      const add = await dialog(page).getByRole("button", { name: "Add", exact: true }).isVisible();
      return { pass: count && cancel && add, detail: `Count: ${count}; Cancel: ${cancel}; Add: ${add}` };
    });
  },
});
