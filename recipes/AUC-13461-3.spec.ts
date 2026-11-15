// Lesson:  AUC-13461 - Accelerate request management using Rovo
//          https://community.atlassian.com/learning/lesson/accelerate-request-management-with-rovo
// Image:   #3, section "Steps to update the request types of work items" (Triage dialog outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT14PAK.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14PAK'
// Selects two work items in the IT Support (ITS) "All open tickets" queue and opens Triage. Update is never
// clicked. Rovo's suggested values change from run to run, so they are masked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, fakeProfileNames, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

// The queue can render the button twice (toolbar and overflow): use the visible one
const triage = '[data-testid="ai-bulk-move.ui.magic-button.magic-button"]:visible >> nth=0';
const rowBoxes = (page: Page) => page.locator('[data-testid$="-checkbox"][data-testid*="rowITS-"] input[type="checkbox"]');
const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: "Triage work items" });

runRecipe({
  file: "AUC-13461-3",
  assetId: "AT14PAK",
  title: "AUC-13461 #3 - Triage work items with Rovo",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/servicedesk/projects/ITS/queues/custom/1");
    await page.locator(triage).waitFor({ timeout: 60_000 });
    await rowBoxes(page).first().waitFor({ state: "attached", timeout: 60_000 });
    await page.waitForTimeout(2_000);
    for (const i of [0, 1]) await rowBoxes(page).nth(i).check({ force: true });
    await page.locator(triage).click();
    await dialog(page).waitFor({ timeout: 60_000 });
    // Wait for Rovo's suggestions: "Triaging 1-3 of 3 work items" shows while it works
    await dialog(page).getByText(/^Triaging/).waitFor({ timeout: 15_000 }).catch(() => {});
    await dialog(page).getByText(/^Triaging/).waitFor({ state: "hidden", timeout: 150_000 });
    await page.waitForTimeout(3_000);
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799); // no tooltip left on the page
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeProfileNames(page);
    await anonymize(page, "AU", FAKE_PEOPLE);
    await spotlight(page, dialog(page), { markers: false });
  },

  // Work items in the queue and Rovo's suggested values
  mask: (page) => [dialog(page).locator('[role="combobox"], button[aria-haspopup]'), page.locator('[data-testid="virtual-table.table.main"]')],

  async checks(page, c) {
    await c.check("Queue 'All open tickets' with a Triage button", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const button = (await page.locator(triage).count()) > 0;
      return { pass: h1 === "All open tickets" && button, detail: `"${h1}"; Triage: ${button}` };
    });

    await c.check("Dialog 'Triage work items' with a link to read more about triaging with Rovo", async () => {
      const title = await dialog(page).getByText("Triage work items", { exact: true }).first().isVisible();
      const link = await dialog(page).getByRole("link", { name: /triag/i }).first().isVisible();
      return { pass: title && link, detail: `Title: ${title}; read more link: ${link}` };
    });

    await c.check("Each work item shows Request type, Status, Priority, Assignee with current and suggested values", async () => {
      const missing = [];
      for (const f of ["Request type", "Status", "Priority", "Assignee"]) if (!(await dialog(page).getByText(f, { exact: true }).first().isVisible())) missing.push(f);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All shown" };
    });

    await c.check("Each work item can be ticked to apply its suggestions", async () => {
      const boxes = await dialog(page).locator('input[type="checkbox"]').count();
      return { pass: boxes >= 2, detail: `${boxes} checkboxes` };
    });

    await c.check("Footer: feedback, Cancel, Update N work items, BETA notice and Rovo", async () => {
      const cancel = await dialog(page).getByRole("button", { name: "Cancel", exact: true }).isVisible();
      const update = await dialog(page).getByRole("button", { name: /^Update \d+ work items?$/ }).isVisible();
      return { pass: cancel && update, detail: `Cancel: ${cancel}; Update N work items: ${update}` };
    });
  },
});
