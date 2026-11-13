// Lesson:  AUC-16040 - Monitor Rovo using insights
//          https://community.atlassian.com/learning/lesson/monitor-rovo-using-insights
// Image:   #1, section "Monitor Rovo user and admin activity using the Audit log" (filters outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/070wp8x50218d7fe4681yf2aix7kn2b7.png
// Recipe:  public.screenshot_recipes where asset_id = '070wp8x50218d7fe4681yf2aix7kn2b7'
// The lesson shows the Activities filter open. Opening it changes nothing; no filter is applied.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebar, sidebarLabels } from "../lib/admin";
import { anonymize, FAKE_PEOPLE, hideMessages, renameOrg, spotlightAreas } from "../lib/tweaks";

// While the Activities list is open the rest of the page is hidden from accessibility queries, so these use CSS
const button = (page: Page, text: RegExp) => page.locator("button", { hasText: text }).first();
const activity = (page: Page) => page.locator('[data-testid="basic-filters-activity"]');
const dropdown = (page: Page) => page.locator('[role="option"]').first().locator("xpath=ancestor::div[.//input[@role='combobox']][1]");

/** Actor, location and IP of each audit row are the test account's: show fake ones (display only). */
async function fakeAuditRows(page: Page, people: string[]) {
  await page.evaluate((people) => {
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th as HTMLElement).innerText.trim());
      const actor = heads.indexOf("Actor");
      const location = heads.indexOf("Location");
      if (actor < 0) continue;
      const names = new Map<string, string>();
      Array.from(table.querySelectorAll("tbody tr")).forEach((row, i) => {
        const a = row.children[actor] as HTMLElement | undefined;
        if (a) {
          const texts: Text[] = [];
          const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.trim()) texts.push(n as Text);
          const real = texts.find((t) => !t.nodeValue!.includes("@") && t.nodeValue!.trim().length > 2)?.nodeValue!.trim() ?? "";
          if (!names.has(real)) names.set(real, people[names.size % people.length]);
          const fake = names.get(real)!;
          for (const t of texts) {
            const v = t.nodeValue!.trim();
            if (v.includes("@")) t.nodeValue = `${fake.toLowerCase().replace(" ", ".")}@example.com`;
            else if (/^[A-Z]{1,2}$/.test(v)) t.nodeValue = fake.split(" ").map((w) => w[0]).join("");
            else t.nodeValue = fake;
          }
        }
        const l = row.children[location] as HTMLElement | undefined;
        if (l) {
          const walker = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.nodeValue?.trim()) continue;
            n.nodeValue = /\d+\.\d+\.\d+|:/.test(n.nodeValue) ? `203.0.113.${10 + (i % 40)}` : "Sydney";
          }
        }
      });
    }
  }, people);
}

runRecipe({
  file: "AUC-16040-1",
  assetId: "070wp8x50218d7fe4681yf2aix7kn2b7",
  title: "AUC-16040 #1 - Audit log, Activities filter",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Insights", "Audit log", /Audit log/);
    await page.getByText(/^Showing \d+ activit/).first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    // Banners first, so the list opens where the lesson shows it
    await hideMessages(page, ["Audit log activities are now available", "Register a webhook"]);
    await activity(page).click();
    await dropdown(page).waitFor();
    await page.waitForTimeout(1_000);
    // The list is wider than the space to the right of the button: keep it inside the window, as in the lesson
    await dropdown(page).evaluate((d) => {
      const room = innerWidth - 40 - d.getBoundingClientRect().left;
      if (d.getBoundingClientRect().width > room) d.style.maxWidth = d.style.width = `${room}px`;
    });
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeAuditRows(page, FAKE_PEOPLE);
    await anonymize(page, "AU", FAKE_PEOPLE);
    // Outline Audit log in the sidebar, the first row of filters and the open Activities list (separate areas:
    // overlapping ones would cancel each other's highlight)
    const basic = button(page, /^Basic$/);
    const location = button(page, /^Location/);
    await spotlightAreas(page, [page.locator(`${sidebar} a`, { hasText: /^Audit log$/ }), [basic, location], dropdown(page)]);
  },

  // Dates, IPs and activities are site data
  mask: (page) => [page.locator("table tbody")],

  async checks(page, c) {
    await c.check("Sidebar: Insights > Analytics, Audit log", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Insights", "Analytics", "Audit log"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title 'Audit log' with an Export log button", async () => {
      // The heading also holds "Powered by Atlassian Guard" on a second line
      const h1 = (await page.locator("h1").first().innerText()).split("\n")[0].trim();
      const exp = await button(page, /^Export log$/).isVisible();
      return { pass: h1 === "Audit log" && exp, detail: `"${h1}"; Export log: ${exp}` };
    });

    await c.check("Basic and ALQL views", async () => {
      const basic = await button(page, /^Basic$/).isVisible();
      const alql = await button(page, /^ALQL$/).isVisible();
      return { pass: basic && alql, detail: `Basic: ${basic}; ALQL: ${alql}` };
    });

    await c.check("Filters: Date, Activities, Actor, IP Address, Location", async () => {
      const missing = [];
      for (const f of [/^Date/, /^Activit(y|ies)/, /^Actor/, /^IP Address/, /^Location/]) {
        if (!(await button(page, f).isVisible())) missing.push(f.source.replace(/[\^()|]/g, ""));
      }
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Activities list opens with a search box and activities grouped under Settings", async () => {
      const open = await dropdown(page).isVisible();
      const search = open && (await dropdown(page).locator("input").first().isVisible());
      const options = open ? await dropdown(page).locator('[role="option"]').count() : 0;
      const settings = open && (await dropdown(page).getByText("Settings", { exact: true }).first().isVisible());
      return { pass: open && search && options > 0 && settings, detail: `Open: ${open}; search: ${search}; activities: ${options}; Settings group: ${settings}` };
    });

    await c.check("Activity list columns: Date, Location, Actor, Activity", async () => {
      // A header can carry a tooltip text on later lines
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim());
      const missing = ["Date", "Location", "Actor", "Activity"].filter((t) => !cols.includes(t));
      return { pass: !missing.length, detail: `Columns: ${cols.join(", ")}` };
    });
  },
});
