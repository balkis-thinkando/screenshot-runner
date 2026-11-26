// Lesson:  AUC-1836 - Create basic workflows in Jira
//          https://community.atlassian.com/learning/lesson/create-a-new-workflow-in-jira
// Image:   #1, section "Explore the workflow editors" (new workflow editor with "CS: Jira Service Management default
//          workflow" open and the Done status selected in the side panel; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT14Q80.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14Q80'
// Test data: the lesson's workflow exists on the test site (Customer Support, CS). Opens it in the workflow editor
// (the Edit link of Jira admin settings > Work items > Workflows) and clicks the DONE status to show its side panel.
// Nothing is changed: Update workflow is never clicked, and the run ends with the editor open.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { basicTweaks, openPage } from "../lib/b3-jreports";

const WORKFLOW = { id: "3e8ee3c2-8057-4251-a85b-0ec343c452f0", name: "CS: Jira Service Management default workflow" };
const panel = (page: Page) => page.locator('[data-testid="workflow-editor-details-panel.details-panel-resize-wrapper"]');
const STATUSES = ["START", "OPEN", "PENDING", "WORK IN PROGRESS", "DONE", "REOPENED"];

runRecipe({
  file: "AUC-1836-1",
  assetId: "AT14Q80",
  title: "AUC-1836 #1 - Workflow editor, Done status",
  product: "jira",

  async navigate(page, s) {
    await openPage(page, s, `/jira/settings/issues/workflows/${WORKFLOW.id}`, (p) => p.locator('[data-testid="workflow-editor.canvas"]'), "Workflow editor", { closeTours: false });
    await page.locator('[data-testid="workflow-editor.canvas"]').getByText("DONE", { exact: true }).first().click();
    await panel(page).getByText("Done", { exact: true }).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await basicTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Header: workflow name and 'Used in 1 space'", async () => {
      const name = await page.getByText(WORKFLOW.name, { exact: true }).first().isVisible();
      const used = (await page.locator('[data-testid="associated-projects-expander.button-count"]').innerText().catch(() => "")).trim();
      return { pass: name && /^Used in \d+ space/.test(used), detail: `Name: ${name}; "${used}"` };
    });

    await c.check("Toolbar: Add status, Add Transition, Add Rule", async () => {
      const ids = ["add-status", "add-transition", "add-rule"];
      const vis = await Promise.all(ids.map((i) => page.locator(`[data-testid="workflow-editor.toolbar.${i}"]`).isVisible()));
      return { pass: vis.every(Boolean), detail: ids.map((i, n) => `${i}: ${vis[n]}`).join("; ") };
    });

    await c.check("Update workflow (disabled, nothing changed), Close and More actions buttons", async () => {
      const update = page.getByRole("button", { name: "Update workflow" });
      const disabled = await update.isDisabled().catch(() => false);
      const close = await page.locator('[data-testid="workflow-editor.toolbar.discard"]').isVisible();
      const more = await page.locator('[data-testid="workflow-editor-toolbar.more-actions-button"]').isVisible();
      const rovo = await page.locator('[data-testid="workflow-editor.toolbar.rovochat"]').isVisible();
      return { pass: disabled && close && more, detail: `Update disabled: ${disabled}; Close: ${close}; More: ${more}${rovo ? "; extra 'Ask Rovo' button (not in the lesson)" : ""}` };
    });

    await c.check("Diagram / Text switch and 'Show transition labels'", async () => {
      const diagram = await page.getByRole("radio", { name: "Diagram" }).isChecked().catch(() => false);
      const text = await page.getByRole("radio", { name: "Text" }).isVisible().catch(() => false);
      const labels = await page.locator('[data-testid="workflow-editor.show-transition-labels"]').isVisible();
      return { pass: diagram && text && labels, detail: `Diagram selected: ${diagram}; Text: ${text}; labels box: ${labels}` };
    });

    await c.check("Diagram statuses: START, OPEN, PENDING, WORK IN PROGRESS, DONE, REOPENED", async () => {
      const text = await page.locator('[data-testid="workflow-editor.canvas"]').innerText();
      const missing = STATUSES.filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Status side panel for Done: Name, Category, Approval, Transitions, Properties, Delete status", async () => {
      const text = await panel(page).innerText();
      const missing = ["Status", "Name", "Done", "Category", "Approval", "Transitions", "Properties", "Delete status"].filter((t) => !text.includes(t));
      const removeReplace = text.includes("Remove") && text.includes("Replace");
      return {
        pass: !missing.length,
        detail: missing.length ? `UI change, missing: ${missing.join(", ")}${removeReplace ? " (the panel now ends with Remove and Replace buttons)" : ""}` : "All present",
      };
    });

    await c.check("Transitions into Done listed: Reopen issue, Mark as done; 'Allow issues in any status to move to this one'", async () => {
      const text = await panel(page).innerText();
      const missing = ["Reopen issue", "Mark as done"].filter((t) => !text.includes(t));
      const any = /in any status to move to this one/.test(text);
      const grouped = text.includes("Incoming") && text.includes("Outgoing");
      return {
        pass: !missing.length && any,
        detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}any-status option: ${any}${grouped ? "; UI change: transitions are now collapsed under Incoming and Outgoing" : ""}`,
      };
    });

    await c.check("Mini map with zoom slider and Give feedback", async () => {
      const zoom = await page.getByRole("button", { name: "Zoom in" }).isVisible();
      const fb = await page.getByRole("button", { name: "Give feedback" }).isVisible();
      return { pass: zoom && fb, detail: `Zoom: ${zoom}; Give feedback: ${fb}` };
    });
  },
});
