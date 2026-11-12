// Lesson:  AUC-1706 - Configure space functionality across Confluence
//          https://community.atlassian.com/learning/lesson/configure-space-functionality-across-confluence
// Image:   #4, section "Manage templates and blueprints used across your Confluence site." (global templates)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/617467i3515u28hilk1s5840783k76n3.png
// Recipe:  public.screenshot_recipes where asset_id = '617467i3515u28hilk1s5840783k76n3'

import { Locator, Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, FAKE_PEOPLE, fakeNames, arrowTo, hideMessages, spotlightAreas } from "../lib/tweaks";

const link = (page: Page) => page.locator(`${adminNav} a[data-testid="globaltemplates"]`);
const title = (page: Page) => page.locator(`${mainContent} h2`, { hasText: /^Global templates and blueprints$/ });
const section = (page: Page, name: string) => page.locator(`${mainContent} h3`, { hasText: new RegExp(`^${name}$`) });
const templatesTable = (page: Page) => page.locator(`${mainContent} [data-testid="global-pages-templates--table"]`);
const addButton = (page: Page) => page.locator(mainContent).getByRole("button", { name: "Add global template" }).or(page.locator(mainContent).getByRole("link", { name: "Add global template" }));

/** A fixed, invisible box around the given elements plus padding, to outline them as one area. */
async function areaAround(page: Page, name: string, parts: Locator[], pad = { x: 18, y: 14 }) {
  const boxes = [];
  for (const l of parts) {
    // Parts that are not on the page (e.g. the empty-state text once a template exists) are skipped
    if (!(await l.isVisible())) continue;
    const b = await l.boundingBox();
    if (b) boxes.push(b);
  }
  if (!boxes.length) throw new Error(`areaAround: nothing visible for ${name}`);
  const x = Math.min(...boxes.map((b) => b.x)) - pad.x;
  const y = Math.min(...boxes.map((b) => b.y)) - pad.y;
  const r = { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) + pad.x - x, height: Math.max(...boxes.map((b) => b.y + b.height)) + pad.y - y };
  await page.evaluate(([name, r]) => {
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-tweak", name);
    d.style.cssText = `position:fixed;pointer-events:none;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;
    document.body.appendChild(d);
  }, [name, r] as const);
  return page.locator(`[data-screenshot-tweak="${name}"]`);
}

runRecipe({
  file: "AUC-1706-4",
  assetId: "617467i3515u28hilk1s5840783k76n3",
  title: "AUC-1706 #4 - Global templates",
  product: "confluence",

  // Settings > Configuration > Global templates and blueprints, as in the lesson
  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    if (!(await link(page).isVisible())) await page.locator(`${adminNav} [data-testid="Configuration"]`).click();
    await link(page).click();
    await section(page, "Global templates").waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    // Names first (Andrea Wilson, as in the lesson): anonymize() puts initials in the avatars, which fakeNames would rename too
    await fakeNames(page, "Last updated by");
    await anonymize(page, "AU", FAKE_PEOPLE);
    await page.mouse.move(1270, 790);
    // Sidebar scrolled so the Settings heading sits just below the sidebar header, as in the lesson
    await page.locator("#admin-side-nav-settings-heading").evaluate((el) => {
      const nav = el.closest<HTMLElement>('[data-testid="side-navigation-content"]')!;
      nav.scrollTop += el.getBoundingClientRect().top - 148;
    });
    await page.waitForTimeout(500);
    // Outline the selected sidebar item and the Global templates section (heading, button, table)
    const area = await areaAround(page, "global-templates-area", [
      section(page, "Global templates"),
      addButton(page),
      templatesTable(page),
      page.getByText("There are no global templates at the moment."),
    ], { x: 18, y: 8 });
    await spotlightAreas(page, [link(page), area]);
    // Arrow from just above the sidebar item to the top of the section
    await arrowTo(page, area, { offsetY: 10 });
  },

  // Templates, their authors and dates are site data
  mask: (page) => [templatesTable(page).locator("tbody")],

  async checks(page, c) {
    await c.check("Page title reads 'Global templates and blueprints'", async () => {
      const t = await title(page).isVisible();
      return { pass: t, detail: t ? "Present" : `Not found; headings: ${(await page.locator(`${mainContent} h2`).allInnerTexts()).join(", ")}` };
    });

    await c.check("Global templates and blueprints is selected in the sidebar under Settings > Configuration", async () => {
      const current = await link(page).getAttribute("aria-current");
      return { pass: current === "page", detail: current === "page" ? "Selected" : "Not the selected item" };
    });

    await c.check("Intro: 'Templates are pre-defined pages and live docs that can be used as prototypes across the site.' and 'More about global templates'", async () => {
      const intro = await page.getByText(/^Templates are pre-defined pages and live docs that can be used as prototypes across the site\./).isVisible();
      const more = await page.locator(mainContent).getByRole("button", { name: "More about global templates" }).or(page.locator(mainContent).getByRole("link", { name: "More about global templates" })).isVisible();
      return { pass: intro && more, detail: `Intro ${intro ? "present" : "not found"}; link ${more ? "present" : "not found"}` };
    });

    await c.check("Sections start with: Global templates, Global blueprints", async () => {
      const h3 = (await page.locator(`${mainContent} h3`).allInnerTexts()).map((t) => t.trim());
      return sameOrder(h3.slice(0, 2), ["Global templates", "Global blueprints"]);
    });

    await c.check("Global templates has an 'Add global template' button, right of the heading", async () => {
      const b = await addButton(page).boundingBox();
      const h = await section(page, "Global templates").boundingBox();
      const pass = !!b && !!h && b.x > h.x + 200 && Math.abs(b.y + b.height / 2 - (h.y + h.height / 2)) < 30;
      return { pass, detail: b ? (pass ? "Present, right of the heading" : "Present, but not next to the heading") : "Not found" };
    });

    await c.check("Global templates table columns: Title, Description, Last updated by, Updated, Actions", async () => {
      const heads = (await templatesTable(page).locator("th").allInnerTexts()).map((t) => t.trim());
      return sameOrder(heads, ["Title", "Description", "Last updated by", "Updated", "Actions"]);
    });

    await c.check("Test data: Global templates lists at least one template, with edit and delete actions", async () => {
      const rows = await templatesTable(page).locator("tbody tr").count();
      const actions = rows ? await templatesTable(page).locator("tbody tr").first().locator("button, a").count() : 0;
      const pass = rows > 0 && actions >= 2;
      return { pass, detail: rows ? `${rows} template(s); ${actions} action(s) on the first` : "No global templates on the site (the lesson shows one, e.g. 'Marketing Team Meeting Notes')" };
    });
  },
});
