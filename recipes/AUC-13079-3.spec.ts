// Lesson:  AUC-13079 - Define work item security for company-managed spaces with schemes
//          https://community.atlassian.com/learning/lesson/issue-security-scheme-jira
// Image:   #3, section "Associate a work item security scheme with a space" (Create space, "Name your space" step with
//          Company-managed selected and "Share settings with an existing space" checked; the checkbox and the space
//          picker are outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ke8t8d7116s0730133q2jr2e7c7hx23x.png
// Recipe:  public.screenshot_recipes where asset_id = 'ke8t8d7116s0730133q2jr2e7c7hx23x'
// Spaces > Create space > Software development > Scrum > Use template, then picks Company-managed and ticks Share
// settings. Read only: no name or key is typed and Next is never clicked, so no space is created.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { openSignedIn } from "../lib/jira";
import { closeTours } from "../lib/b2-jira";
import { failOnReauth, jadminTweaks } from "../lib/b3-jadmin";

const managedField = (page: Page) => page.getByText("How your space is managed").first().locator("xpath=following::input[1]");
const share = (page: Page) => page.getByRole("checkbox", { name: /Share settings with an existing space/ });
const pickerLabel = (page: Page) => page.getByText(/Select an existing space to share settings with/).first();
const picker = (page: Page) => pickerLabel(page).locator("xpath=following::input[1]");

runRecipe({
  file: "AUC-13079-3",
  assetId: "ke8t8d7116s0730133q2jr2e7c7hx23x",
  title: "AUC-13079 #3 - Create space, share settings",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/projects");
    const create = page.getByRole("button", { name: /^Create space/ }).first();
    await create.waitFor({ timeout: 90_000 });
    await failOnReauth(page);
    await page.waitForTimeout(1_500);
    await closeTours(page);
    await create.click();
    await page.getByText("Software development", { exact: true }).first().click({ timeout: 30_000 });
    await page.getByText("Scrum", { exact: true }).first().click({ timeout: 30_000 });
    await page.getByRole("button", { name: /Use template/ }).first().click({ timeout: 30_000 });
    await page.getByText("Name your space", { exact: true }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    // A space type step appears first on some sites; the naming step has the type dropdown
    await managedField(page).click();
    await page.getByRole("option", { name: /Company-managed/ }).first().click();
    await share(page).check();
    await pickerLabel(page).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    // Unfocus the checkbox (the lesson shows no focus ring) and park the mouse
    await page.getByText("Name your space", { exact: true }).click();
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    // The picker's visible box: the first ancestor of its input that is as wide as the form fields
    await picker(page).evaluate((el) => {
      let p: HTMLElement | null = el as HTMLElement;
      while (p && p.getBoundingClientRect().width < 470) p = p.parentElement;
      p?.setAttribute("data-jadmin", "space-picker");
    });
    await spotlightAreas(page, [[share(page), pickerLabel(page), page.locator('[data-jadmin="space-picker"]')]]);
  },

  async checks(page, c) {
    await c.check("Step 'Name your space' with Back to templates", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Name your space") && t.includes("Back to templates") && t.includes("Required fields are marked with an asterisk");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Fields: Name, How your space is managed = Company-managed, Key", async () => {
      const t = await page.locator("body").innerText();
      const managed = /How your space is managed\*?\s*\n\s*Company-managed/.test(t) || (await page.getByText("Company-managed", { exact: true }).first().isVisible().catch(() => false));
      const missing = ["Name", "Key"].filter((l) => !new RegExp(`(^|\\n)${l}\\*?\\s*(\\n|$)`).test(t));
      return { pass: managed && !missing.length, detail: `Company-managed: ${managed}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("'Share settings with an existing space' checked, with the space picker", async () => {
      const checked = await share(page).isChecked().catch(() => false);
      const label = await pickerLabel(page).isVisible().catch(() => false);
      const hint = await page.getByText("Search spaces", { exact: true }).first().isVisible().catch(() => false);
      return { pass: checked && label && hint, detail: `Checked: ${checked}; picker: ${label}; 'Search spaces' hint: ${hint}` };
    });

    await c.check("Template card 'Shared with an existing project'", async () => {
      const t = await page.locator("body").innerText();
      const lesson = t.includes("Shared with an existing project");
      const now = t.includes("Shared with an existing space");
      return { pass: lesson, detail: lesson ? "Present" : now ? "UI change: card is now 'Shared with an existing space'" : "Template card missing" };
    });

    await c.check("Footer 'Step 1 of 3' with Next, and the Company-managed space preview", async () => {
      const t = await page.locator("body").innerText();
      const ok = /Step 1 of 3/.test(t) && /\bNext\b/.test(t) && t.includes("Company-managed space");
      return { pass: ok, detail: `Step: ${(t.match(/Step \d of \d/) ?? ["?"])[0]}; preview: ${t.includes("Company-managed space")}` };
    });
  },
});
