// Lesson:  AUC-13461 - Accelerate request management using Rovo
//          https://community.atlassian.com/learning/lesson/accelerate-request-management-with-rovo
// Image:   #1, section "How to create request type and field suggestions" (menu, prompt and suggestions outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT14PEE.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14PEE'
// Asks Rovo for request type suggestions in IT Support (ITS) and selects one. Create is never clicked.
// The suggestions are written by AI and change from run to run, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const PROMPT = "I am in HR that manages onboarding new employees";
const createButton = '[data-testid="servicedesk-ticket-types-config.ui.create-button.add-new-ticket-type-button"]';
const useRovo = '[data-testid="servicedesk-configurations-suggestion-button.ui.create-using-ai-item"]';
const promptBox = (page: Page) => page.getByPlaceholder(/My team provides/).or(page.locator("main textarea")).first();
// Suggestions are cards around a hidden radio input
const options = (page: Page) => page.locator('[role="main"] input[type="radio"]');
// The suggestion panel: from the prompt down to its Create button
const panel = (page: Page) =>
  page.locator('[role="main"] div').filter({ has: page.getByText(PROMPT, { exact: true }) }).filter({ has: page.getByText(/Content is based on your permissions/) }).last();

runRecipe({
  file: "AUC-13461-1",
  assetId: "AT14PEE",
  title: "AUC-13461 #1 - Create request types using Rovo",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/servicedesk/projects/ITS/settings/request-types");
    await page.locator(createButton).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3_000);
    // Feature tours ("Turn your team's knowledge into playbooks") cover the page
    if (await page.getByRole("dialog").first().isVisible()) await page.keyboard.press("Escape");
    await page.locator(createButton).click();
    await page.locator(useRovo).click();
    await promptBox(page).click();
    await page.keyboard.type(PROMPT);
    await page.keyboard.press("Enter");
    await options(page).first().waitFor({ state: "attached", timeout: 150_000 });
    await page.waitForTimeout(2_000);
    // Select the last suggestion, as in the lesson (selecting is not creating)
    await options(page).last().check({ force: true });
  },

  async tweak(page, s) {
    await page.mouse.move(640, 790);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page, "AU", FAKE_PEOPLE);
    // The lesson also shows the Create request type menu; it closes when the prompt opens, so outline the button
    await spotlightAreas(page, [page.locator(createButton), panel(page)]);
  },

  // AI-written suggestions
  mask: (page) => [page.locator('[role="main"] label:has(input[type="radio"])'), page.getByText(PROMPT, { exact: true }).locator("xpath=following::*[.//input[@type='radio']][1]")],

  async checks(page, c) {
    await c.check("Page 'Service requests' in IT Support space settings", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Service requests", detail: `"${h1}"` };
    });

    await c.check("Rovo lists several pre-configured request types to choose from", async () => {
      const n = await options(page).count();
      return { pass: n >= 3, detail: `${n} suggestions` };
    });

    await c.check("Suggestion panel: feedback buttons, Cancel and Create", async () => {
      const cancel = await page.locator('[role="main"]').getByRole("button", { name: /^Cancel/ }).first().isVisible();
      const create = await page.locator('[role="main"]').getByRole("button", { name: /^Create$|^Create\s/ }).last().isVisible();
      return { pass: cancel && create, detail: `Cancel: ${cancel}; Create: ${create}` };
    });

    await c.check("Notice 'Content is based on your permissions, and its quality may vary'", async () => {
      const notice = await page.getByText(/Content is based on your permissions/).first().isVisible();
      return { pass: notice, detail: notice ? "Present" : "Missing" };
    });
  },
});
