// Lesson:  AUC-1136 - Configure Jira board columns and statuses
//          https://community.atlassian.com/learning/lesson/configure-jira-board-columns-and-statuses
// Image:   #1, section "Match your board to your workflow" (Employee Onboarding business space board, columns To Do,
//          In Progress, In review, Done; cards show labels, due date and parent; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT123Y.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT123Y'
// Opens the Employee Onboarding board, the lesson's board. The cards change as work items move, so they are masked.

import { Page, test } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { closeTours } from "../lib/b2-jira";
import { boardTweaks, recentSpaces, selectedTab, tabLabels } from "../lib/b3-jboards";

const columnHeads = (page: Page) => page.locator('[data-testid="board.content.cell.column-header"]');
const cards = (page: Page) => page.locator('[data-testid="board.content.cell.card"]');

runRecipe({
  file: "AUC-1136-1",
  assetId: "AT123Y",
  title: "AUC-1136 #1 - Business space board",
  product: "jira",

  async navigate(page, s) {
    // This board can take over a minute to load
    test.setTimeout(240_000);
    await openSignedIn(page, s, "/jira/core/projects/EO/board");
    await page.getByRole("heading", { name: /Employee Onboarding/ }).or(page.getByText("Employee Onboarding").first()).first().waitFor({ timeout: 90_000 });
    await cards(page).first().waitFor({ timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await closeTours(page);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await boardTweaks(page, s);
  },

  mask: (page) => [recentSpaces(page), cards(page)],

  async checks(page, c) {
    await c.check("Space 'Employee Onboarding' with the Board tab selected", async () => {
      const h = await page.getByRole("heading", { name: /Employee Onboarding/ }).first().isVisible().catch(() => false);
      const sel = await selectedTab(page);
      return { pass: h && sel === "Board", detail: `Heading: ${h}; selected tab: "${sel}"` };
    });

    await c.check("Tabs: Summary, Timeline, Board, List, Approvals, Forms, Docs, Attachments, Reports", async () => {
      const tabs = await tabLabels(page);
      const missing = ["Summary", "Timeline", "Board", "List", "Approvals", "Forms", "Docs", "Attachments", "Reports"].filter((t) => !tabs.includes(t));
      return { pass: !missing.length, detail: `${missing.length ? `Not shown as tabs: ${missing.join(", ")}; ` : ""}tabs: ${tabs.join(", ")}` };
    });

    await c.check("Toolbar: Search board, people, Filter, Group", async () => {
      const text = await page.locator('[data-testid="page-layout.main"]').innerText().catch(() => "");
      const missing = ["Filter", "Group"].filter((t) => !new RegExp(`\\b${t}\\b`).test(text));
      const search = await page.getByPlaceholder(/Search bo/).first().isVisible().catch(() => false);
      return { pass: !missing.length && search, detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}search box: ${search}` };
    });

    await c.check("Columns in workflow order: To Do, In Progress, In review, Done, each with a count", async () => {
      const names = (await columnHeads(page).locator('[data-testid="board.content.cell.column-header.name"]').allInnerTexts()).map((t) => t.trim());
      const heads: string[] = [];
      for (let i = 0; i < names.length; i++) {
        const t = (await columnHeads(page).nth(i).innerText().catch(() => "")).split("\n").map((l) => l.trim()).filter(Boolean);
        heads.push(`${names[i]} ${t.find((l) => /^\d+$/.test(l)) ?? "(no count)"}`);
      }
      const order = names.join("|") === "To Do|In Progress|In review|Done";
      const counts = heads.every((h) => /\d+$/.test(h));
      return { pass: order && counts, detail: `Columns: ${heads.join(", ")}${order ? "" : " (lesson order: To Do, In Progress, In review, Done)"}` };
    });

    await c.check("Cards show labels, due date and parent", async () => {
      const text = await cards(page).allInnerTexts().then((t) => t.join("\n")).catch(() => "");
      const label = /marketing|finance|engineering/i.test(text);
      const due = /Due date/i.test(text) || /\b[A-Z][a-z]{2} \d{1,2}, 20\d\d\b/.test(text);
      const parent = /Parent/.test(text) || /EO-\d+ \w+ - Improve/.test(text);
      return {
        pass: label && due && parent,
        detail: `Labels: ${label}; due dates: ${due}; parent: ${parent}${/Due date|Parent/.test(text) ? "" : " (note: cards no longer label the due date and parent fields, as the lesson's older UI did)"}`,
      };
    });
  },
});
