// Lesson:  AUC-1706 - Configure space functionality across Confluence
//          https://community.atlassian.com/learning/lesson/configure-space-functionality-across-confluence
// Image:   #5, section "Manage templates and blueprints used across your Confluence site." (global blueprints)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/f4o4at0683ot125nbx8x8322360oa7e4.png
// Recipe:  public.screenshot_recipes where asset_id = 'f4o4at0683ot125nbx8x8322360oa7e4'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, spotlightAreas } from "../lib/tweaks";

const link = (page: Page) => page.locator(`${adminNav} a[data-testid="globaltemplates"]`);
const section = (page: Page, name: string) => page.locator(`${mainContent} h3`, { hasText: new RegExp(`^${name}$`) });
// The first table after the Global blueprints heading
const blueprintsTable = (page: Page) => page.locator(`${mainContent} table:not([data-testid="global-pages-templates--table"])`).first();

// Blueprints (rows with a toggle) in the order the lesson shows them
const lessonBlueprints = [
  "HR Knowledge Base Management", "Service team health monitor", "ITSM change management", "Product Requirements Blueprint",
  "Incident postmortem", "Vision to values", "Content strategy",
];

/** A fixed, invisible box over part of the window, to outline an area that is not one element. */
async function areaBox(page: Page, name: string, r: { x: number; y: number; width: number; height: number }) {
  await page.evaluate(([name, r]) => {
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-tweak", name);
    d.style.cssText = `position:fixed;pointer-events:none;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;
    document.body.appendChild(d);
  }, [name, r] as const);
  return page.locator(`[data-screenshot-tweak="${name}"]`);
}

/** Rows of the blueprints table: blueprint rows have a toggle, template rows an Edit button. */
async function blueprintRows(page: Page) {
  return blueprintsTable(page).locator("tbody tr").evaluateAll((rows) =>
    rows.map((r) => ({
      text: (r as HTMLElement).innerText.trim(),
      toggle: r.querySelectorAll('input[type="checkbox"]').length > 0,
      edit: Array.from(r.querySelectorAll("button, a")).some((b) => /edit/i.test(b.getAttribute("aria-label") ?? (b as HTMLElement).innerText)),
    })),
  );
}

runRecipe({
  file: "AUC-1706-5",
  assetId: "f4o4at0683ot125nbx8x8322360oa7e4",
  title: "AUC-1706 #5 - Global blueprints",
  product: "confluence",

  // Settings > Configuration > Global templates and blueprints, as in the lesson
  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    if (!(await link(page).isVisible())) await page.locator(`${adminNav} [data-testid="Configuration"]`).click();
    await link(page).click();
    await section(page, "Global blueprints").waitFor({ timeout: 60_000 });
    await blueprintsTable(page).locator("tbody tr").first().waitFor();
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await page.mouse.move(1270, 790);
    // Sidebar scrolled so the Settings heading sits just below the sidebar header, as in the lesson
    await page.locator("#admin-side-nav-settings-heading").evaluate((el) => {
      const nav = el.closest<HTMLElement>('[data-testid="side-navigation-content"]')!;
      nav.scrollTop += el.getBoundingClientRect().top - 148;
    });
    // Page scrolled to the Global blueprints section
    await section(page, "Global blueprints").evaluate((el) => {
      const main = el.closest<HTMLElement>("#AkMainContent")!;
      main.scrollTop += el.getBoundingClientRect().top - 70;
    });
    await page.waitForTimeout(500);
    // The end of the Global templates section (its empty-state text on a site without templates) peeks out
    // above the heading; the lesson shows nothing there
    const top = (await section(page, "Global blueprints").boundingBox())!.y;
    await page.locator("#AkMainContent").evaluate((main, top) => {
      for (const el of Array.from(main.querySelectorAll<HTMLElement>("p, span, div"))) {
        const r = el.getBoundingClientRect();
        if (!el.children.length && el.innerText?.trim() && r.bottom > 0 && r.bottom < top - 4) el.style.visibility = "hidden";
      }
    }, top);
    // Outline the selected sidebar item and the Global blueprints section down to the bottom of the window
    const h = (await section(page, "Global blueprints").boundingBox())!;
    const t = (await blueprintsTable(page).boundingBox())!;
    const area = await areaBox(page, "global-blueprints-area", { x: h.x - 18, y: h.y - 10, width: t.x + t.width + 18 - (h.x - 18), height: 800 - 25 - (h.y - 10) });
    await spotlightAreas(page, [link(page), area]);
  },

  // Which blueprints are on or off is site data
  mask: (page) => [blueprintsTable(page).locator('input[type="checkbox"]')],

  async checks(page, c) {
    await c.check("Global templates and blueprints is selected in the sidebar under Settings > Configuration", async () => {
      const current = await link(page).getAttribute("aria-current");
      return { pass: current === "page", detail: current === "page" ? "Selected" : "Not the selected item" };
    });

    await c.check("Global blueprints section with a 'What are blueprints?' link", async () => {
      const h = await section(page, "Global blueprints").isVisible();
      const what = await page.locator(mainContent).getByRole("button", { name: "What are blueprints?" }).or(page.locator(mainContent).getByRole("link", { name: "What are blueprints?" })).isVisible();
      return { pass: h && what, detail: `Heading ${h ? "present" : "not found"}; link ${what ? "present" : "not found"}` };
    });

    await c.check("Global blueprints table columns: Title, Actions", async () => {
      const heads = (await blueprintsTable(page).locator("th").allInnerTexts()).map((t) => t.trim());
      return sameOrder(heads, ["Title", "Actions"]);
    });

    await c.check(`Blueprints start with: ${lessonBlueprints.join(", ")}`, async () => {
      const names = (await blueprintRows(page)).filter((r) => r.toggle).map((r) => r.text);
      // Up to the last blueprint the lesson shows, so a blueprint added in between shows as added
      const last = names.indexOf(lessonBlueprints[lessonBlueprints.length - 1]);
      return sameOrder(names.slice(0, last >= 0 ? last + 1 : lessonBlueprints.length), lessonBlueprints);
    });

    await c.check("Each blueprint has an on/off toggle, followed by its templates with an edit icon", async () => {
      const rows = await blueprintRows(page);
      const first = rows.slice(0, 20);
      const odd = first.filter((r) => !r.toggle && !r.edit).map((r) => r.text);
      const pass = first.length > 0 && first[0].toggle && !odd.length && first.some((r) => r.edit);
      return { pass, detail: pass ? "Toggles and edit icons present" : `Rows without a toggle or edit icon: ${odd.join(", ") || "none"}; first row toggle: ${first[0]?.toggle}` };
    });
  },
});
