// Lesson:  AUC-16038 - Configure and monitor Rovo data sources
//          https://community.atlassian.com/learning/lesson/configure-and-monitor-rovo-data-sources
// Image:   #1, section "Add and manage Rovo connectors" (connector list outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/l84bg2fvpo7860v2m3b30ohrb43253bu.png
// Recipe:  public.screenshot_recipes where asset_id = 'l84bg2fvpo7860v2m3b30ohrb43253bu'
// The lesson lists GitHub and Workday connectors. Real ones need accounts and consent in those apps, so the rows
// are display-only fakes (owner decision, 13 Nov 2026). Their icons come from the Add connector catalog, which
// is opened and closed without selecting anything.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openOrgPage, sidebarLabels } from "../lib/admin";
import { anonymize, fakeButton, fakeLozenge, fakeTable, hideMessages, renameOrg, setCount, spotlight } from "../lib/tweaks";

const icons: Record<string, string> = {};

/** The icon of a connector in the Add connector catalog (left of its title). */
async function catalogIcon(page: Page, name: string) {
  const title = page.locator('[data-testid="connector-title-with-tooltip"]', { hasText: new RegExp(`^${name}$`) }).first();
  await title.scrollIntoViewIfNeeded();
  return title.evaluate((t) => {
    const tb = t.getBoundingClientRect();
    for (let row = t.parentElement; row; row = row.parentElement) {
      const icon = Array.from(row.querySelectorAll<HTMLElement>("svg, img")).find((el) => {
        const r = el.getBoundingClientRect();
        return r.right <= tb.left + 2 && r.width >= 16 && r.width <= 48;
      });
      if (icon) return icon.outerHTML;
    }
    return "";
  });
}

const iconCell = (icon: string, name: string, sub: string) =>
  `<span style="display:inline-flex;align-items:center;gap:12px"><span style="display:inline-flex;width:24px;height:24px">${icon}</span>` +
  `<span><span style="display:block">${name}</span><span style="display:block;font-size:12px;color:#505258">${sub}</span></span></span>`;

runRecipe({
  file: "AUC-16038-1",
  assetId: "l84bg2fvpo7860v2m3b30ohrb43253bu",
  title: "AUC-16038 #1 - Teamwork Graph connectors",
  product: "admin",

  async navigate(page, s) {
    await openOrgPage(page, s, "Connectors", "All connectors", /connectors/i);
    await page.waitForTimeout(2_000);
    // A first-visit question ("What apps does your organization use?") may cover the page: close it without saving
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add connector", exact: true }).first().click();
    await page.locator('[data-testid="connector-title-with-tooltip"]').first().waitFor({ timeout: 30_000 });
    icons.github = await catalogIcon(page, "GitHub");
    icons.workday = await catalogIcon(page, "Workday");
    await page.keyboard.press("Escape");
    await page.locator('[data-testid="connector-title-with-tooltip"]').first().waitFor({ state: "hidden", timeout: 10_000 });
    await page.getByText(/^Showing \d+ items?/).first().waitFor({ timeout: 30_000 });
  },

  async tweak(page, s) {
    await page.mouse.move(1279, 799);
    await hideMessages(page, ["Upcoming update"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    const empty = page.locator('[data-testid="empty-state-stack"]').first();
    if (await empty.isVisible()) {
      await fakeTable(
        page,
        empty,
        [{ label: "Connectors", width: "34%" }, { label: "Connector type" }, { label: "Status" }, { label: "Indexed objects" }, { label: "Actions", width: "10%", align: "right" }],
        [
          [{ html: iconCell(icons.github, "GitHub", "GitHub connector") }, "Synced", { html: fakeLozenge("Ongoing sync") }, "3", { html: fakeButton("•••") }],
          [{ html: iconCell(icons.github, "GitHub", "GitHub Connector for Rovo") }, "Synced", { html: fakeLozenge("Ongoing sync") }, "3", { html: fakeButton("•••") }],
          [{ html: iconCell(icons.workday, "Workday", "Workday connector") }, "Synced", { html: fakeLozenge("Up to date") }, "Not applicable", { html: fakeButton("•••") }],
        ],
      );
      await setCount(page, page.getByText(/^Showing 0 items/), "Showing 3 items");
    }
    // The page is a little wider than the window: keep the list inside it, then scroll the list into view
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur(); // focus ring left on Add connector by the catalog
      const t = document.querySelector<HTMLElement>('[data-screenshot-tweak="fake-table"]');
      if (t) t.style.width = `${innerWidth - t.getBoundingClientRect().left - 40}px`;
      // The Group by button sits past the window edge too
      const group = Array.from(document.querySelectorAll<HTMLElement>("button")).find((b) => b.innerText.startsWith("Group by"));
      const over = group ? group.getBoundingClientRect().right - (innerWidth - 40) : 0;
      if (group && over > 0) group.style.transform = `translateX(-${over}px)`;
    });
    // Scroll the list into view in whichever element scrolls this page
    await page.locator('[data-screenshot-tweak="fake-table"]').evaluate((t) => {
      const overflow = t.getBoundingClientRect().bottom - (innerHeight - 30);
      if (overflow <= 0) return;
      for (let a = t.parentElement; a; a = a.parentElement) {
        const y = getComputedStyle(a).overflowY;
        if (a.scrollHeight > a.clientHeight && (y === "auto" || y === "scroll")) return void (a.scrollTop += overflow);
      }
      document.scrollingElement!.scrollTop += overflow;
    });
    await page.waitForTimeout(800);
    // Outline the connector list with its controls, as in the lesson
    await spotlight(page, page.getByPlaceholder("Search apps").or(page.locator('[data-screenshot-tweak="fake-table"]')), { markers: false });
  },

  async checks(page, c) {
    await c.check("Sidebar: Connectors > All connectors", async () => {
      const labels = await sidebarLabels(page);
      const missing = ["Connectors", "All connectors"].filter((t) => !labels.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Page title reads 'Teamwork Graph connectors'", async () => {
      const h1 = (await page.locator("h1").first().innerText()).trim();
      return { pass: h1 === "Teamwork Graph connectors", detail: `"${h1}"` };
    });

    await c.check("Summary cards: connected apps, identity provider, setup quiz", async () => {
      const missing = [];
      for (const t of [/of your team.s apps/, /^Connect your identity provider$/, /^Complete setup quiz$/]) if (!(await page.getByText(t).first().isVisible())) missing.push(t.source);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Add connector button", async () => {
      const add = await page.getByRole("button", { name: "Add connector", exact: true }).first().isVisible();
      return { pass: add, detail: add ? "Present" : "Missing" };
    });

    await c.check("GitHub and Workday icons found in the Add connector catalog", async () => {
      const ok = Boolean(icons.github && icons.workday);
      return { pass: ok, detail: `GitHub: ${icons.github ? "found" : "missing"}; Workday: ${icons.workday ? "found" : "missing"}` };
    });
  },
});
