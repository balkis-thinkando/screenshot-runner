// Lesson:  AUC-12977 - Prepare for sprint planning with Rovo's readiness checker agent
//          https://community.atlassian.com/learning/lesson/prepare-for-sprint-planning-with-rovos-readiness-checker-agent
// Image:   #2, section "Use the readiness checker to report on multiple work items" (Readiness Score column)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/88mw23rl3537j2e41067fm0tkoa3w5w2.png
// Recipe:  public.screenshot_recipes where asset_id = '88mw23rl3537j2e41067fm0tkoa3w5w2'
// Display-only fake (owner OK, 17 Nov 2026): the site has no "Readiness Score" field, so the last data column
// of the real PLAT search (the first empty visible column) is shown as "Readiness Score" with Pass / Warnings /
// Fail values.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openJqlSearch } from "../lib/jira";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

const JQL = 'project = PLAT AND status = "To Do"';
const SCORES = ["Pass", "Warnings", "Fail", "Pass", "Warnings", "Pass", "Pass", "Pass", "Warnings", "Pass", "Fail", "Fail", "Warnings", "Pass"];

async function fakeReadinessColumn(page: Page) {
  await page.evaluate((scores) => {
    const table = document.querySelector("table");
    if (!table) return;
    const headers = Array.from(table.querySelectorAll("thead th"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    // The first visible column with no values (in Nov 2026: Employee), found on the body cells
    const width = rows[0]?.querySelectorAll("td").length ?? 0;
    let idx = -1;
    for (let i = 2; i < width; i++) {
      const cells = rows.map((tr) => tr.querySelectorAll("td")[i]);
      if (cells[0] && cells[0].getBoundingClientRect().right < innerWidth && cells.every((c) => !(c?.textContent ?? "").trim())) { idx = i; break; }
    }
    if (idx < 0) idx = width - 2;
    // Its header: the one at the same horizontal position
    const left = rows[0].querySelectorAll("td")[idx].getBoundingClientRect().left;
    const head = headers.find((h) => Math.abs(h.getBoundingClientRect().left - left) < 4);
    if (!head) return;
    const walker = document.createTreeWalker(head, NodeFilter.SHOW_TEXT);
    let done = false;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!done && (n.nodeValue ?? "").trim()) { n.nodeValue = "Readiness Score"; done = true; }
      else if (done && /^(Employee|Assignee|Reporter)$/.test((n.nodeValue ?? "").trim())) n.nodeValue = "";
    }
    const colour: Record<string, string> = { Pass: "#22A06B", Warnings: "#F5CD47", Fail: "#C9372C" };
    Array.from(table.querySelectorAll("tbody tr")).forEach((tr, i) => {
      const cell = tr.querySelectorAll("td")[idx];
      if (!cell) return;
      const v = scores[i % scores.length];
      cell.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;font:14px sans-serif;color:#172B4D"><span style="width:12px;height:12px;border-radius:50%;background:${colour[v]}"></span>${v}</span>`;
    });
    head.setAttribute("data-screenshot-fake", "readiness");
  }, SCORES);
}

runRecipe({
  file: "AUC-12977-2",
  assetId: "88mw23rl3537j2e41067fm0tkoa3w5w2",
  title: "AUC-12977 #2 - Readiness Score column",
  product: "jira",

  async navigate(page, s) {
    await openJqlSearch(page, s, JQL);
    await page.locator("table tbody tr").nth(5).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeReadinessColumn(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[3]);
    await fakeProfileNames(page);
    await anonymize(page, "JE", FAKE_PEOPLE);
  },

  // Which work items are To Do changes over time
  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Page 'All work' with the JQL view and the PLAT To Do query", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const jql = (await page.locator('[data-testid="jql-editor-input"]').innerText().catch(() => "")).replace(/\s+/g, " ");
      return { pass: h1 === "All work" && /PLAT/.test(jql) && /To Do/.test(jql), detail: `"${h1}"; JQL: ${jql.slice(0, 80)}` };
    });

    await c.check("Toolbar: Ask AI, Basic/JQL switch, Clear filters, Save filter", async () => {
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["Basic", "JQL", "Save filter"].filter((t) => !text.includes(t));
      const ai = /Ask AI|\bAI\b/.test(text);
      return { pass: !missing.length && ai, detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}AI button: ${ai}` };
    });

    await c.check("Columns: Work, Assignee, Reporter, Priority, Status (plus Readiness Score, faked)", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
      const missing = ["Work", "Assignee", "Reporter", "Priority", "Status"].filter((w) => !cols.includes(w));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Work item count footer ('50 of 1000+')", async () => {
      const f = await page.getByText(/^\d+ of \d+\+?$/).first().isVisible();
      return { pass: f, detail: f ? "Present" : "Missing" };
    });
  },
});
