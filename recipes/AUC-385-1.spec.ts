// Lesson:  AUC-385 - Use basic search to find information in Jira
//          https://community.atlassian.com/learning/lesson/use-jira-basic-search
// Image:   #1, section "Use basic search to find work items" (All work in Basic mode, Filters list in the sidebar)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12DPMF.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12DPMF'
// All work with an empty query, switched to the Basic view. Nothing is saved. The result rows are site data (masked).

import { runRecipe } from "../lib/recipe";
import { jiraPeopleTweaks, openAllWork } from "../lib/b2-jira";

runRecipe({
  file: "AUC-385-1",
  assetId: "AT12DPMF",
  title: "AUC-385 #1 - All work in Basic search",
  product: "jira",

  async navigate(page, s) {
    await openAllWork(page, s, "Basic");
    await page.locator("table tbody tr").nth(5).waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
  },

  // Which work items come first changes over time
  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Page 'All work' in the Basic view", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      const basic = page.getByRole("button", { name: "Basic", exact: true }).or(page.getByRole("radio", { name: "Basic", exact: true })).first();
      const on = (await basic.getAttribute("aria-pressed")) ?? (await basic.getAttribute("aria-checked"));
      return { pass: h1 === "All work" && on === "true", detail: `"${h1}"; Basic selected: ${on}` };
    });

    await c.check("Toolbar: Ask AI, Basic/JQL, Search work items, Space, Assignee, Type, Status, More filters, Save filter", async () => {
      const text = await page.locator("main, [role=main]").first().innerText();
      const missing = ["Basic", "JQL", "Space", "Assignee", "Type", "Status", "More filters", "Save filter"].filter((t) => !text.includes(t));
      const ai = /Ask AI|\bAI\b/.test(text);
      const search = await page.getByPlaceholder(/Search work/).first().isVisible().catch(() => false);
      return { pass: !missing.length && ai && search, detail: `Missing: ${missing.join(", ") || "none"}; AI: ${ai}; search box: ${search}` };
    });

    await c.check("Header buttons: Apps, Share, Export", async () => {
      const found: string[] = [];
      for (const t of ["Apps", "Share", "Export"])
        if (await page.getByRole("button", { name: new RegExp(`^${t}`) }).first().isVisible().catch(() => false)) found.push(t);
      const missing = ["Apps", "Share", "Export"].filter((t) => !found.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")} (UI change: Export is no longer a header button)` : "All present" };
    });

    await c.check("Columns: Work, Priority, Assignee", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
      const missing = ["Work", "Priority", "Assignee"].filter((w) => !cols.includes(w));
      // The columns are the test account's own All work column settings (site data), not the product default
      return { pass: !missing.length, detail: `${missing.length ? `Missing: ${missing.join(", ")} (column settings of the test account); ` : ""}Columns: ${cols.join(", ")}` };
    });

    await c.check("Sidebar Filters: Search work items and the default filters", async () => {
      const side = await page.locator("nav, [data-testid*=sidebar]").first().innerText().catch(() => "");
      const all = await page.locator("body").innerText();
      const missing = ["Search work items", "My open work items", "Reported by me", "All work items", "Open work items", "Done work items", "Viewed recently", "Created recently"].filter((t) => !all.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : `All present${side ? "" : " (sidebar text not read)"}` };
    });

    await c.check("Work item count footer ('50 of 1000+')", async () => {
      const f = await page.getByText(/^\d+ of \d+\+?$/).first().isVisible();
      return { pass: f, detail: f ? "Present" : "Missing" };
    });
  },
});
