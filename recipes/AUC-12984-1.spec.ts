// Lesson:  AUC-12984 - Automate release notes generation with Rovo
//          https://community.atlassian.com/learning/lesson/automate-release-notes-generation-with-rovo
// Image:   #1, section "Automate the release notes generation" (the flow's steps outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/o0603nd78t6552m2m3qiv8648rw8anym.png
// Recipe:  public.screenshot_recipes where asset_id = 'o0603nd78t6552m2m3qiv8648rw8anym'
// Test data: the switched-off PLAT flow "Create release notes" (lib/plat-flows.ts). The flow is only opened.
// Display-only: the Publish step's page title (editing it needs a Confluence connection the test account does
// not have) shows the lesson's "{{version.name}} Release Notes" under "Release notes in Platform Development".

import { runRecipe } from "../lib/recipe";
import { flowSteps, markStepCards, openPlatFlow, PLAT_FLOWS, relabel } from "../lib/plat-flows";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

runRecipe({
  file: "AUC-12984-1",
  assetId: "o0603nd78t6552m2m3qiv8648rw8anym",
  title: "AUC-12984 #1 - Create release notes flow",
  product: "jira",

  async navigate(page, s) {
    await openPlatFlow(page, s, PLAT_FLOWS.releaseNotes);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await relabel(page, '"{{now.mediumDate}} - Issue summary of Platform Development"', '"{{version.name}} Release Notes" under Release notes in Platform Development');
    await page.evaluate(() => document.querySelectorAll("img").forEach((i) => { if (i.getBoundingClientRect().x < 700) i.setAttribute("data-screenshot-keep", ""); }));
    await fakeSignedInUser(page, FAKE_PEOPLE[1]);
    await anonymize(page, "OB", FAKE_PEOPLE);
    const cards = await markStepCards(page);
    await spotlightAreas(page, [[cards.nth(0), cards.nth(1), cards.nth(2)]]);
  },

  async checks(page, c) {
    await c.check("Breadcrumb Spaces / Platform Development / Space settings / Automation", async () => {
      const ok = await page.getByText("Space settings").first().isVisible() && (await page.getByText("Automation").first().isVisible());
      return { pass: ok, detail: ok ? "Present" : "Missing" };
    });

    await c.check("Header: flow name, edit/list view switch, Enabled toggle, Save, More", async () => {
      const name = (await page.locator('input[name="name"]').inputValue()) === "Create release notes";
      const enabled = await page.getByText(/^(Enabled|Disabled)$/).first().isVisible();
      const save = await page.getByRole("button", { name: "Save" }).first().isVisible();
      return { pass: name && enabled && save, detail: `Name: ${name}; toggle: ${enabled}; Save: ${save} (the test flow is Disabled)` };
    });

    await c.check("Steps: Version released, Use agent (Release Notes Drafter), Publish new page in Confluence", async () => {
      const steps = await flowSteps(page);
      const want = [/Version released/, /Release Notes Drafter/, /Publish new page in Confluence/];
      const missing = want.filter((w) => !steps.some((t) => w.test(t))).map((w) => w.source);
      return { pass: !missing.length, detail: `Steps: ${steps.join(" | ")}` };
    });

    await c.check("Agent step labelled 'Use agent' above the agent name", async () => {
      const label = await page.getByText("Use agent", { exact: true }).first().isVisible().catch(() => false);
      return { pass: label, detail: label ? "Present" : "The agent step shows only the agent name and prompt" };
    });

    await c.check("Flow details: Name, Description, Scope, Owner, Actor, Notify on error, Who can edit", async () => {
      const text = await page.locator("body").innerText();
      const missing = ["Flow details", "Name", "Description", "Scope", "Owner", "Actor", "Notify on error", "Who can edit this flow?"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
