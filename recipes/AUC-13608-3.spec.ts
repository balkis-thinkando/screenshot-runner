// Lesson:  AUC-13608 - Detect and respond to incidents using Rovo
//          https://community.atlassian.com/learning/lesson/detect-and-respond-to-incidents-with-rovo
// Image:   #3, section "Generate a post-incident summary using AI" (AI summary with Add to description outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/uw0xh65720037yki1cfvb321622w13gq.png
// Recipe:  public.screenshot_recipes where asset_id = 'uw0xh65720037yki1cfvb321622w13gq'
// Test data and steps: lib/pir.ts. Clicks "Suggest description" when it is offered (the AI writes a summary;
// "Add to description" and Create are never clicked). In Nov 2026 the button was gone, so the recipe captures
// the dialog and the check reports it.

import { runRecipe } from "../lib/recipe";
import { openPirDialog, pirDialog, suggestButton } from "../lib/pir";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const result = (page: Parameters<typeof pirDialog>[0]) =>
  pirDialog(page).locator("div").filter({ has: page.getByRole("button", { name: "Add to description" }) }).filter({ hasText: /Atlassian Intelligence|Rovo/ }).last();

runRecipe({
  file: "AUC-13608-3",
  assetId: "uw0xh65720037yki1cfvb321622w13gq",
  title: "AUC-13608 #3 - Post-incident review, AI summary",
  product: "jira",

  async navigate(page, s) {
    await openPirDialog(page, s);
    if (await suggestButton(page).isVisible()) {
      await suggestButton(page).click();
      await pirDialog(page).getByRole("button", { name: "Add to description" }).waitFor({ timeout: 120_000 });
      await pirDialog(page).getByRole("button", { name: "Add to description" }).scrollIntoViewIfNeeded();
    } else {
      await pirDialog(page).getByText("Description", { exact: true }).first().scrollIntoViewIfNeeded();
    }
    await page.mouse.move(640, 790);
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    if (await result(page).isVisible().catch(() => false)) await spotlight(page, result(page), { markers: false });
    else await spotlight(page, pirDialog(page), { markers: false });
  },

  // The AI-written summary differs on every run
  mask: (page) => [result(page)],

  async checks(page, c) {
    await c.check("'Suggest description' is offered in the post-incident review dialog", async () => {
      const shown = (await suggestButton(page).isVisible()) || (await result(page).isVisible().catch(() => false));
      return { pass: shown, detail: shown ? "Present" : "No Suggest description in the dialog" };
    });

    await c.check("AI summary with sections (root causes, mitigation, lessons learnt, next action, reference)", async () => {
      const text = (await result(page).isVisible().catch(() => false)) ? (await result(page).innerText()).toLowerCase() : "";
      const missing = ["root cause", "mitigation", "lessons", "next action", "reference"].filter((t) => !text.includes(t));
      return { pass: !!text && !missing.length, detail: text ? (missing.length ? `Missing: ${missing.join(", ")}` : "All sections") : "No AI summary" };
    });

    await c.check("Summary footer: feedback buttons, Cancel, Add to description; 'Content is based on your permissions'", async () => {
      const add = await pirDialog(page).getByRole("button", { name: "Add to description" }).isVisible().catch(() => false);
      const notice = await pirDialog(page).getByText(/Content is based on your permissions/).first().isVisible().catch(() => false);
      return { pass: add && notice, detail: `Add to description: ${add}; notice: ${notice}` };
    });
  },
});
