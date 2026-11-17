import { Page } from "@playwright/test";
import { openSignedIn } from "./jira";
import { Settings } from "./supabase";

// The "Create post-incident review" dialog in IT Support (ITS), for the AUC-13608 shots.
// Test data (16-17 Nov 2026, owner OK): the [System] Post-incident review work type was added to ITS's own
// work-type scheme, with a "Create a post-incident review" request type (in no portal group). Create is never
// clicked.

/** A completed ITS incident opened behind the dialog. */
export const PIR_INCIDENT = "ITS-6258";

export const pirDialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Create/ }).last();
export const suggestButton = (page: Page) => pirDialog(page).getByRole("button", { name: /Suggest description/ });

/** Opens Create, picks the post-incident review work type in ITS and turns "Use request type fields" off. */
export async function openPirDialog(page: Page, s: Settings) {
  // An ITS incident: the space's sidebar shows behind the dialog, as in the lesson
  await openSignedIn(page, s, `/jira/servicedesk/projects/ITS/issues/${PIR_INCIDENT}`);
  const create = page.locator("button:visible", { hasText: /^Create$/ }).first();
  await create.waitFor({ timeout: 60_000 });
  await page.getByText(/My laptop is not turning on/).first().waitFor({ timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
  if (await page.getByRole("dialog").first().isVisible()) await page.keyboard.press("Escape");
  await create.click();
  await pirDialog(page).waitFor({ timeout: 60_000 });
  // Each field's input is the label's "for" target
  const field = async (label: RegExp) => {
    const id = await pirDialog(page).locator("label", { hasText: label }).first().getAttribute("for");
    return page.locator(`[id="${id}"]`);
  };
  // Wait for the form (Summary field) before reading the preselected space
  await pirDialog(page).locator("label", { hasText: /^Summary/ }).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);
  // Space: IT Support (opened from an ITS incident, it is usually preselected)
  if (!(await pirDialog(page).innerText()).includes("IT Support (ITS)")) {
    await (await field(/^Space/)).click({ force: true });
    await page.keyboard.type("IT Support");
    await page.getByRole("option", { name: /IT Support/ }).first().click();
    await page.waitForTimeout(2_000);
  }
  await (await field(/^Work type/)).click({ force: true });
  await page.keyboard.type("Post-incident review");
  await page.getByRole("option", { name: /Post-incident review/ }).first().click();
  await pirDialog(page).getByText("Create a post-incident review").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  // Loom's "Show, don't tell" tip covers the form
  const dismiss = pirDialog(page).getByRole("button", { name: "Dismiss" });
  if (await dismiss.isVisible()) await dismiss.click();
  // The lesson shows the full form: "Use request type fields" off
  const toggle = pirDialog(page).getByRole("checkbox", { name: /Use request type fields/ }).or(pirDialog(page).getByRole("switch", { name: /Use request type fields/ })).first();
  if (await toggle.isChecked().catch(() => false)) {
    await toggle.click({ force: true });
    await pirDialog(page).getByText("Description", { exact: true }).first().waitFor({ timeout: 15_000 });
  }
  await page.waitForTimeout(1_500);
}
