// Lesson:  AUC-13608 - Detect and respond to incidents using Rovo
//          https://community.atlassian.com/learning/lesson/detect-and-respond-to-incidents-with-rovo
// Image:   #2, section "Generate a post-incident summary using AI" (Suggest description outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/25282t7r831bo0751xiso6n351d33oml.png
// Recipe:  public.screenshot_recipes where asset_id = '25282t7r831bo0751xiso6n351d33oml'
// Test data and steps: lib/pir.ts (Create post-incident review in ITS, never submitted).
// In Nov 2026 the dialog had no "Suggest description" (Rovo's "Improve description" sits in the Description
// field instead): the recipe then outlines the Description field and the check reports the change.

import { runRecipe } from "../lib/recipe";
import { openPirDialog, pirDialog, suggestButton } from "../lib/pir";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const description = (page: Parameters<typeof pirDialog>[0]) =>
  pirDialog(page).locator("div").filter({ has: page.getByText("Description", { exact: true }) }).filter({ has: page.getByRole("button", { name: /Improve description/ }) }).last();

runRecipe({
  file: "AUC-13608-2",
  assetId: "25282t7r831bo0751xiso6n351d33oml",
  title: "AUC-13608 #2 - Create post-incident review, Suggest description",
  product: "jira",

  async navigate(page, s) {
    await openPirDialog(page, s);
    const target = (await suggestButton(page).isVisible()) ? suggestButton(page) : description(page);
    await target.scrollIntoViewIfNeeded();
    await page.mouse.move(640, 790);
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    await spotlight(page, (await suggestButton(page).isVisible()) ? suggestButton(page) : description(page), { markers: false });
  },

  async checks(page, c) {
    await c.check("Dialog 'Create post-incident review'", async () => {
      const t = (await pirDialog(page).locator("h1, h2, [role=heading]").first().innerText()).trim();
      return { pass: /Create post-incident review$/.test(t), detail: `"${t}"` };
    });

    await c.check("Fields: Project (Space), Work type [System] Post-incident review, Request type", async () => {
      const text = await pirDialog(page).innerText();
      const ok = /\[System\] Post-incident review/.test(text) && /Create a post-incident review/.test(text);
      return { pass: ok, detail: ok ? "Present" : "Work type or request type missing" };
    });

    await c.check("'Use request type fields' switch (off)", async () => {
      const shown = await pirDialog(page).getByText("Use request type fields").first().isVisible();
      return { pass: shown, detail: shown ? "Present" : "Missing" };
    });

    await c.check("Suggestions section with a 'Suggest description' button", async () => {
      const button = await suggestButton(page).isVisible();
      const improve = await pirDialog(page).getByRole("button", { name: /Improve description/ }).first().isVisible().catch(() => false);
      return { pass: button, detail: button ? "Present" : `No Suggest description${improve ? "; the Description field offers 'Improve description' instead" : ""}` };
    });

    await c.check("Footer: Create another, Cancel, Create", async () => {
      const another = await pirDialog(page).getByText("Create another").first().isVisible();
      const create = await pirDialog(page).getByRole("button", { name: "Create", exact: true }).isVisible();
      return { pass: another && create, detail: `Create another: ${another}; Create: ${create}` };
    });
  },
});
