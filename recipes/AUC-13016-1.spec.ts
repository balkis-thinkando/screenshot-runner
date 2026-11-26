// Lesson:  AUC-13016 - Add users to a Jira space
//          https://community.atlassian.com/learning/lesson/add-user-to-jira-space
// Image:   #1, section "Add users to space roles" (Space settings > Access of the Employee Onboarding team-managed space
//          with the "Add people to Employee Onboarding" dialog, one person picked, Role = Member; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/6b8wjt63igrq3hdkrfiv8qf642a72j7m
// Recipe:  public.screenshot_recipes where asset_id = '6b8wjt63igrq3hdkrfiv8qf642a72j7m'
// Opens Space settings > Access of Employee Onboarding (EO), clicks Add people and picks the first suggested person
// who is not the test account. Read only: Add is never clicked, so nobody is added. All names in the dialog and the
// access list are shown as fake names (display only).

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { FAKE_PEOPLE } from "../lib/tweaks";
import { addPeopleButton, fakeNamesIn, jadminTweaks, openSpaceAccess } from "../lib/b3-jadmin";

const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Add people to/ }).last();
const picker = (page: Page) => dialog(page).locator("#invite-user-picker");
/** Suggested people under the field ("+ <avatar> <name>" buttons; the dialog's "Close Modal" button looks like a name). */
const suggestions = (page: Page) =>
  dialog(page)
    .getByRole("button")
    .filter({ hasText: /^\s*[A-Z][a-z'-]+( [A-Z][a-z'-]+){1,2}\s*$/ })
    .filter({ has: page.locator('img, span[role="img"]') })
    .filter({ hasNotText: /Close Modal/ });

runRecipe({
  file: "AUC-13016-1",
  assetId: "6b8wjt63igrq3hdkrfiv8qf642a72j7m",
  title: "AUC-13016 #1 - Add people to a space dialog",
  product: "jira",

  async navigate(page, s) {
    await openSpaceAccess(page, s, "EO");
    await addPeopleButton(page).click();
    await picker(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_500);
    // First suggested person who is not the signed-in test account (compared in the page, never printed)
    const me = await page.evaluate(async () => (await fetch("/gateway/api/me").then((r) => r.json()).catch(() => null))?.name ?? "");
    const n = await suggestions(page).count();
    let picked = false;
    for (let i = 0; i < n && !picked; i++) {
      const b = suggestions(page).nth(i);
      if ((await b.innerText()).trim() === me) continue;
      await b.click();
      picked = true;
    }
    if (!picked) throw new Error("No suggested person to pick in the Add people dialog");
    await page.waitForTimeout(1_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    // Everyone in the dialog and the access list gets a fake name; the lesson's picked person is the first fake
    await fakeNamesIn(page, dialog(page).or(page.locator("table")), FAKE_PEOPLE.filter((p) => p !== "Kevin Campbell"));
    await jadminTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Behind the dialog: Space settings > Access of the Employee Onboarding business space", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Space settings") && t.includes("Employee Onboarding") && t.includes("Access");
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Dialog 'Add people to Employee Onboarding' with More actions (...)", async () => {
      const t = await dialog(page).innerText().catch(() => "");
      const more = await dialog(page).getByRole("button", { name: "More actions" }).isVisible().catch(() => false);
      return { pass: t.includes("Add people to Employee Onboarding") && more, detail: `Title: ${t.includes("Add people to Employee Onboarding")}; More actions: ${more}` };
    });

    await c.check("'Names or emails' field with one person picked", async () => {
      const t = await dialog(page).innerText();
      const label = t.includes("Names or emails");
      const chips = await dialog(page).locator('[data-testid*="tag"], [role="listitem"], [class*="multi-value"], [data-testid*="multi-value"]').count();
      const button = await dialog(page).getByRole("button", { name: /Add 1 person/ }).isVisible().catch(() => false);
      return { pass: label && (chips > 0 || button), detail: `Label: ${label}; picked chips: ${chips}; 'Add 1 person' button: ${button}` };
    });

    await c.check("'or add from' Google, Slack, Microsoft", async () => {
      const t = await dialog(page).innerText();
      const missing = ["or add from", "Google", "Slack", "Microsoft"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `UI change, missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Role dropdown set to Member", async () => {
      const t = await dialog(page).innerText();
      const ok = /Role\*?\s*\n\s*Member/.test(t);
      return { pass: ok, detail: ok ? "Member" : "Role field or value missing" };
    });

    await c.check("reCAPTCHA notice, Cancel and 'Add 1 person' buttons", async () => {
      const t = await dialog(page).innerText();
      const recaptcha = t.includes("protected by reCAPTCHA");
      const cancel = await dialog(page).getByRole("button", { name: "Cancel" }).isVisible().catch(() => false);
      const addLabel = (await dialog(page).getByRole("button", { name: /^Add/ }).last().innerText().catch(() => "")).trim();
      return { pass: recaptcha && cancel && addLabel === "Add 1 person", detail: `reCAPTCHA: ${recaptcha}; Cancel: ${cancel}; Add button: "${addLabel}"` };
    });
  },
});
