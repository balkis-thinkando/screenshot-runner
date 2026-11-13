// Lesson:  AUC-13461 - Accelerate request management using Rovo
//          https://community.atlassian.com/learning/lesson/accelerate-request-management-with-rovo
// Image:   #2, section "How to create request type and field suggestions" (description, Suggest fields and suggestions outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT14PEZ.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14PEZ'
// Opens the request form of "Get IT help" in IT Support (ITS) and asks Rovo for field suggestions. No field is
// added and the form is not saved. The suggestions are written by AI, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const REQUEST_TYPE = "Get IT help";
const suggest = '[data-testid="servicedesk-suggest-request-form-fields-button.ui.suggest-fields-button"]';
const description = (page: Page) => page.getByText("Request type description").locator("xpath=ancestor::div[.//textarea or .//input or .//*[@contenteditable]][1]");
// The suggestion list: from "Here are some suggestions" to its Cancel button
const suggestions = (page: Page) =>
  page.locator('[role="main"] div').filter({ has: page.getByText(/Here are some suggestions/) }).filter({ has: page.getByRole("button", { name: "Cancel" }) }).last();

runRecipe({
  file: "AUC-13461-2",
  assetId: "AT14PEZ",
  title: "AUC-13461 #2 - Suggest fields with Rovo",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/servicedesk/projects/ITS/settings/request-types");
    await page.getByText(REQUEST_TYPE, { exact: true }).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
    if (await page.getByRole("dialog").first().isVisible()) await page.keyboard.press("Escape");
    await page.getByText(REQUEST_TYPE, { exact: true }).first().click();
    await page.locator(suggest).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
    await page.locator(suggest).click();
    await page.getByText(/Here are some suggestions/).first().waitFor({ timeout: 90_000 });
    await page.waitForTimeout(2_000);
  },

  async tweak(page, s) {
    await page.mouse.move(640, 790);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page, "AU", FAKE_PEOPLE);
    // The intro text and the (scrolling) list right after it
    const intro = page.getByText(/Here are some suggestions/).first();
    const list = [intro, intro.locator("xpath=following-sibling::*[1]")];
    await spotlightAreas(page, [description(page), page.locator(suggest), list]);
  },

  // AI-suggested field names
  mask: (page) => [page.getByText(/Here are some suggestions/).first().locator("xpath=following-sibling::*[1]")],

  async checks(page, c) {
    await c.check("Tabs: Request form, Work item view, Workflow statuses", async () => {
      const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.trim());
      const missing = ["Request form", "Work item view", "Workflow statuses"].filter((t) => !tabs.includes(t));
      return { pass: !missing.length, detail: `Tabs: ${tabs.join(", ")}` };
    });

    await c.check("Request type description field", async () => {
      const shown = await page.getByText("Request type description").first().isVisible();
      return { pass: shown, detail: shown ? "Present" : "Missing" };
    });

    await c.check("Suggest fields button", async () => {
      const shown = await page.locator(suggest).isVisible();
      return { pass: shown, detail: shown ? "Present" : "Missing" };
    });

    await c.check("Suggestions list with a link to create new custom fields, feedback and Cancel", async () => {
      const link = await page.getByRole("link", { name: /create new custom fields/i }).first().isVisible();
      const cancel = await suggestions(page).getByRole("button", { name: "Cancel" }).isVisible();
      return { pass: link && cancel, detail: `Custom fields link: ${link}; Cancel: ${cancel}` };
    });

    await c.check("Fields panel on the right with a search box", async () => {
      const fields = await page.getByText("Fields", { exact: true }).first().isVisible();
      const search = await page.getByPlaceholder(/search all fields/i).first().isVisible();
      return { pass: fields && search, detail: `Fields heading: ${fields}; search: ${search}` };
    });
  },
});
