// Lesson:  AUC-13608 - Detect and respond to incidents using Rovo
//          https://community.atlassian.com/learning/lesson/detect-and-respond-to-incidents-with-rovo
// Image:   #3, section "Generate a post-incident summary using AI" (AI summary with Add to description outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/uw0xh65720037yki1cfvb321622w13gq.png
// Recipe:  public.screenshot_recipes where asset_id = 'uw0xh65720037yki1cfvb321622w13gq'
// Test data and steps: lib/pir.ts. Clicks "Suggest description" when it is offered (the AI writes a summary;
// "Add to description" and Create are never clicked).
// Product change (Nov 2026): "Suggest description" and its AI summary panel were removed; the Description
// field now has a Rovo menu and "Improve description" and starts empty. So the capture still has example
// text like the lesson (owner feedback on SHOT-57), the tweak fills the empty Summary and Description with a
// fixed example post-incident summary for ITS-6258, laid out like the lesson's AI summary (Root causes,
// Mitigation and resolution, Lessons learnt, Next action, Reference). Display only: the text is injected into
// the page (input value, editor HTML), nothing is typed or run through Rovo, and the dialog is never saved.
// The checks still describe the lesson, so they keep flagging that Suggest description is gone.

import { runRecipe } from "../lib/recipe";
import { Page } from "@playwright/test";
import { openPirDialog, pirDialog, suggestButton } from "../lib/pir";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";

const result = (page: Page) =>
  pirDialog(page).locator("div").filter({ has: page.getByRole("button", { name: "Add to description" }) }).filter({ hasText: /Atlassian Intelligence|Rovo/ }).last();

/** Example post-incident review for ITS-6258 (a laptop that would not turn on), in the lesson's AI summary layout. */
const EXAMPLE_SUMMARY = "PIR: Laptop not turning on (ITS-6258)";
const EXAMPLE_DESCRIPTION = `
<h3>Root causes</h3>
<ul>
  <li><p><strong>Investigation starting point</strong>: Laptop would not power on (root node)</p>
    <ul>
      <li><p><strong>Condition</strong>: Faulty charger left the battery fully drained (failed barrier)</p></li>
      <li><p><strong>Event</strong>: Laptop did not charge or boot (event)</p></li>
      <li><p><strong>PIR action</strong>: Add a charger and battery check to hardware triage (PIR action)</p></li>
    </ul>
  </li>
</ul>
<h3>Mitigation and resolution</h3>
<ul>
  <li><p>Loaner laptop issued so the employee could keep working</p></li>
  <li><p>Charger replaced; battery failed diagnostics and was replaced under warranty</p></li>
</ul>
<h3>Lessons learnt</h3>
<ul>
  <li><p>Test with a known-good charger before escalating</p></li>
</ul>
<h3>Next action</h3>
<ul>
  <li><p>Check battery health on laptops older than three years</p></li>
</ul>
<h3>Reference</h3>
<ul>
  <li><p><a href="#">Incident Reference</a></p></li>
</ul>`;

/** Display only: fills an empty Summary and the Description editor with the example text (no typing, no save). */
async function fillExample(page: Page) {
  const dialog = pirDialog(page);
  const summaryId = await dialog.locator("label", { hasText: /^Summary/ }).first().getAttribute("for").catch(() => null);
  if (summaryId) {
    await page.locator(`[id="${summaryId}"]`).evaluate((el, text) => {
      const input = el as HTMLInputElement;
      if (!input.value) input.value = text;
    }, EXAMPLE_SUMMARY);
  }
  const editor = dialog.locator('.ProseMirror[contenteditable="true"], [contenteditable="true"]').first();
  if (!(await editor.isVisible().catch(() => false))) return;
  // The editor (ProseMirror) would redraw text set inside it, so a copy with the same classes shows the
  // example and the real, empty editor is hidden
  await editor.evaluate((el, html) => {
    // Never cover real content (the "Type /ai to Ask Rovo" placeholder is a widget inside the editor)
    const probe = el.cloneNode(true) as HTMLElement;
    probe.querySelectorAll(".placeholder-decoration").forEach((w) => w.remove());
    if ((probe.textContent ?? "").trim()) return;
    const copy = document.createElement("div");
    copy.className = el.className;
    copy.setAttribute("data-screenshot-tweak", "example-description");
    copy.innerHTML = html.replace(/>\s+</g, "><").trim(); // the editor keeps white space (pre-wrap)
    el.style.display = "none";
    el.after(copy);
    // Like the lesson: the summary fills the dialog, starting at its first heading
    const heading = copy.querySelector("h3");
    heading?.scrollIntoView({ block: "start" });
    for (let p = copy.parentElement; p; p = p.parentElement) {
      if (p.scrollTop > 0) {
        p.scrollTop -= 12;
        break;
      }
    }
  }, EXAMPLE_DESCRIPTION);
  await page.waitForTimeout(500);
}

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
    if (!(await result(page).isVisible().catch(() => false))) await fillExample(page);
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
