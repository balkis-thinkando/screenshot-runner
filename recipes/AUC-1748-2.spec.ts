// Lesson:  AUC-1748 - Use mission control to analyze and respond to Confluence site activity
//          https://community.atlassian.com/learning/lesson/use-confluence-mission-control
// Image:   #2, section "See high-level metrics in the overview."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/utt6s83q7w58keor70lk177t7y17245s.png
// Recipe:  public.screenshot_recipes where asset_id = 'utt6s83q7w58keor70lk177t7y17245s'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

const missionControlLink = (page: Page) => page.locator(`${adminNav} a[data-testid="admin-center"]`);
// The bordered Overview card (h2 > title row > header > card)
const overviewCard = (page: Page) => page.locator("h2", { hasText: "Overview" }).first().locator("xpath=ancestor::div[3]");
// In edit mode each metric has a select ("Select metric to display in Overview section")
const metricSelects = (page: Page) => page.getByRole("combobox", { name: "Select metric to display in Overview section" });
const metricMenu = (page: Page) => page.getByRole("listbox");

/** Replaces the names of the people on Mission control (Confluence admins card) with User A, User B... */
async function neutralPeople(page: Page) {
  await page.evaluate(() => {
    // Safety net: a profile picture that re-renders after anonymize() stays hidden
    const style = document.createElement("style");
    style.setAttribute("data-screenshot-tweak", "people");
    style.textContent = 'img[src*="/aa-avatar/"] { visibility: hidden !important; }';
    document.head.appendChild(style);
    const prefix = "More information about ";
    const real = Array.from(document.querySelectorAll(`[aria-label^="${prefix}"]`))
      .map((el) => el.getAttribute("aria-label")!.slice(prefix.length).trim())
      .filter((n) => n && n !== "this user");
    const names = new Map(Array.from(new Set(real)).map((n, i) => [n, `User ${String.fromCharCode(65 + i)}`]));
    const swap = (v: string) => { for (const [n, f] of names) v = v.replaceAll(n, f); return v; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
  });
}

runRecipe({
  file: "AUC-1748-2",
  assetId: "utt6s83q7w58keor70lk177t7y17245s",
  title: "AUC-1748 #2 - Mission control overview in edit mode",
  product: "confluence",

  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    // Overview > Edit (never Save: the run ends with the page closed, nothing is kept)
    await overviewCard(page).getByRole("button", { name: "Edit", exact: true }).click();
    await metricSelects(page).first().waitFor();
    // Open the first metric dropdown (the input itself is not clickable; its select control is)
    await metricSelects(page).first().locator("xpath=ancestor::div[2]").click();
    await metricMenu(page).waitFor();
  },

  async tweak(page, s) {
    await hideMessages(page, ["Your site now has roles"]);
    await neutralPeople(page);
    await anonymize(page);
    await renameOrg(page, s.test_org, s.display_org_name);
    // Opening the dropdown scrolls the page about 80px so the whole menu fits (it cannot be scrolled back
    // while the menu is open): the page title is just above the capture, the rest matches the lesson
    await page.waitForTimeout(700);
    // Two outlined areas: Mission control in the sidebar, and the Overview card with the open dropdown
    await spotlightAreas(page, [missionControlLink(page), [overviewCard(page), metricMenu(page)]]);
  },

  // The banner and the metric numbers change over time
  mask: (page) => [
    page.locator('[data-testid="ga-space-roles-banner"]'),
    overviewCard(page).locator('[data-testid="main-stat"], [data-testid="footer-container"]'),
  ],

  async checks(page, c) {
    await c.check("Overview in edit mode shows Cancel and Save", async () => {
      const card = overviewCard(page);
      const cancel = await card.getByRole("button", { name: "Cancel", exact: true }).isVisible();
      const save = await card.getByRole("button", { name: "Save", exact: true }).isVisible();
      return { pass: cancel && save, detail: `Cancel ${cancel ? "present" : "missing"}, Save ${save ? "present" : "missing"}` };
    });

    await c.check("A dropdown above each metric: Total spaces, Total content, Confluence searches", async () => {
      const values = await metricSelects(page).evaluateAll((inputs) =>
        // The selected value is the element the input is described by
        inputs.map((i) => document.getElementById(i.getAttribute("aria-describedby")?.split(" ")[0] ?? "")?.innerText.trim() ?? ""),
      );
      const expected = ["Total spaces", "Total content", "Confluence searches"];
      const pass = JSON.stringify(values) === JSON.stringify(expected);
      return { pass, detail: pass ? "Three dropdowns, same metrics" : `Now: ${values.join(", ") || "no dropdowns"}` };
    });

    await c.check("Metric dropdown groups: Activity, Content management, Feature usage, Security", async () => {
      const groups = (await page.locator('[id^="react-select-"][id$="-heading"]').allInnerTexts()).map((t) => t.trim().toLowerCase());
      const expected = ["activity", "content management", "feature usage", "security"];
      const pass = JSON.stringify(groups) === JSON.stringify(expected);
      return { pass, detail: pass ? "Same groups, same order" : `Now: ${groups.join(", ") || "no group headings"}` };
    });

    await c.check("Security metrics in the dropdown include Active public links and Public link views", async () => {
      const options = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
      const missing = ["Active public links", "Public link views"].filter((o) => !options.includes(o));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}. Options: ${options.join(", ")}` : `${options.length} options, both present` };
    });
  },
});
