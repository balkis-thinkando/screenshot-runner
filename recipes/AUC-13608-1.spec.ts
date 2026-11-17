// Lesson:  AUC-13608 - Detect and respond to incidents using Rovo
//          https://community.atlassian.com/learning/lesson/detect-and-respond-to-incidents-with-rovo
// Image:   #1, section "Alert groups powered by Rovo" (Responders/Assignee columns, an alert group row and the
//          "Show alerts ungrouped" switch outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/325but214o5ws2nnc5407m48c62mm7j1.png
// Recipe:  public.screenshot_recipes where asset_id = '325but214o5ws2nnc5407m48c62mm7j1'
// Operations > Alerts, Open filter. The site already has alert groups. Nothing is acknowledged or closed.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlightAreas } from "../lib/tweaks";

const rows = (page: Page) => page.locator("table tbody tr");
const groupRow = (page: Page) => rows(page).filter({ hasText: /Alert group:/ }).first();
const ungrouped = (page: Page) => page.getByText("Show alerts ungrouped").first().locator("xpath=ancestor::*[2]");

runRecipe({
  file: "AUC-13608-1",
  assetId: "325but214o5ws2nnc5407m48c62mm7j1",
  title: "AUC-13608 #1 - Alerts list with alert groups",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/jira/ops/alerts?view=list&query=");
    await rows(page).first().waitFor({ timeout: 60_000 });
    // "A new home for your alerts" tour
    const dismiss = page.getByRole("button", { name: "Dismiss" });
    if (await dismiss.first().isVisible().catch(() => false)) await dismiss.first().click();
    // Default filters > Open, as in the lesson
    await page.getByRole("link", { name: /^Open$/ }).or(page.getByRole("button", { name: /^Open$/ })).first().click().catch(() => {});
    await page.waitForTimeout(3_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
    const areas = [groupRow(page)];
    if (await ungrouped(page).isVisible().catch(() => false)) areas.push(ungrouped(page));
    await spotlightAreas(page, areas);
  },

  // Alerts come and go
  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Page 'Alerts' under Operations, with My alerts, Sort by, List View, Detail View", async () => {
      const h = await page.getByRole("heading", { name: "Alerts" }).first().isVisible();
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["My alerts", "Sort by", "List View", "Detail View"].filter((t) => !text.includes(t));
      return { pass: h && !missing.length, detail: `Heading: ${h}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Filters: Basic/Advanced, Search alerts, Responders, Services, Priority, Status, Time", async () => {
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["Basic", "Advanced", "Responders", "Services", "Priority", "Status", "Time"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("'Show alerts ungrouped' switch", async () => {
      const t = await page.getByText("Show alerts ungrouped").first().isVisible().catch(() => false);
      return { pass: t, detail: t ? "Present" : "Missing" };
    });

    await c.check("Columns: ID, Priority, Summary, Status, Responders, Assignee, Actions", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
      const missing = ["ID", "Priority", "Summary", "Status", "Responders", "Assignee", "Actions"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Alert group rows (G-number, count, 'Alert group:' summary, Ack all / Close all)", async () => {
      const n = await rows(page).filter({ hasText: /Alert group:/ }).count();
      const actions = (await groupRow(page).innerText().catch(() => "")).includes("Ack all");
      return { pass: n > 0 && actions, detail: `${n} alert groups; Ack all/Close all: ${actions}` };
    });
  },
});
