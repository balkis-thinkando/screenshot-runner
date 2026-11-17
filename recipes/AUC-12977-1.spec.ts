// Lesson:  AUC-12977 - Prepare for sprint planning with Rovo's readiness checker agent
//          https://community.atlassian.com/learning/lesson/prepare-for-sprint-planning-with-rovos-readiness-checker-agent
// Image:   #1, section "Use the readiness checker to report on multiple work items" (the flow)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/hpqf2kt6j2u2v1q3v36olrc55wy64nvr.png
// Recipe:  public.screenshot_recipes where asset_id = 'hpqf2kt6j2u2v1q3v36olrc55wy64nvr'
// Test data: the switched-off PLAT flow "Run Readiness Checker for open work items" (lib/plat-flows.ts).
// Display-only: the site has no "Readiness score" field, so the flow's Edit step sets Description; the canvas
// shows the lesson's field name.

import { runRecipe } from "../lib/recipe";
import { flowSteps, openPlatFlow, PLAT_FLOWS, relabel } from "../lib/plat-flows";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

runRecipe({
  file: "AUC-12977-1",
  assetId: "hpqf2kt6j2u2v1q3v36olrc55wy64nvr",
  title: "AUC-12977 #1 - Readiness Checker flow",
  product: "jira",

  async navigate(page, s) {
    await openPlatFlow(page, s, PLAT_FLOWS.readiness);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    // The Edit step's field, on the canvas only
    await page.evaluate(() => {
      for (const h of Array.from(document.querySelectorAll("h1,h2,h3,h4,[role=heading]"))) {
        if ((h.textContent ?? "").trim() !== "Edit work item fields") continue;
        const box = h.closest("[role=button], button, div[tabindex]") ?? h.parentElement?.parentElement;
        const walker = document.createTreeWalker(box ?? h, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.trim() === "Description") n.nodeValue = "Readiness score";
      }
    });
    await page.evaluate(() => document.querySelectorAll("img").forEach((i) => { if (i.getBoundingClientRect().x < 700) i.setAttribute("data-screenshot-keep", ""); }));
    await fakeSignedInUser(page, FAKE_PEOPLE[11]);
    await anonymize(page, "NB", FAKE_PEOPLE);
  },

  async checks(page, c) {
    await c.check("Header: flow name 'Run Readiness Checker for open work items', toggle, Save", async () => {
      const name = (await page.locator('input[name="name"]').inputValue()) === "Run Readiness Checker for open work items";
      const save = await page.getByRole("button", { name: "Save" }).first().isVisible();
      return { pass: name && save, detail: `Name: ${name}; Save: ${save} (the test flow is Disabled)` };
    });

    await c.check("Trigger: Scheduled, on Wed at 9:00 AM", async () => {
      const t = await page.getByText(/^Every .* on Wed at 9:00 AM$/).first().innerText().catch(() => "");
      return { pass: !!t, detail: t ? `"${t}" (lesson: Every 2 weeks on Wed at 9:00 AM)` : "No schedule text" };
    });

    await c.check("Branch 'For: JQL' with the PLAT To Do query", async () => {
      const branch = await page.getByText("For: JQL", { exact: true }).first().isVisible();
      const jql = await page.getByText(/PLAT AND status = "To Do"/).first().isVisible();
      return { pass: branch && jql, detail: `For: JQL: ${branch}; query: ${jql}` };
    });

    await c.check("Steps in the branch: Use agent (Readiness Checker) then Edit work item fields", async () => {
      const steps = await flowSteps(page);
      const ok = steps.some((t) => /Readiness Checker/.test(t)) && steps.some((t) => /Edit work item fields/.test(t));
      const useAgent = await page.getByText("Use agent", { exact: true }).first().isVisible().catch(() => false);
      return { pass: ok && useAgent, detail: `Steps: ${steps.join(" | ")}; 'Use agent' label: ${useAgent}` };
    });

    await c.check("Flow details: Name, Description, Scope, Owner, Actor, Notify on error", async () => {
      const text = await page.locator("body").innerText();
      const missing = ["Flow details", "Name", "Description", "Scope", "Owner", "Actor", "Notify on error"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
