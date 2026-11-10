// Lesson:  AUC-1706 - Configure space functionality across Confluence
//          https://community.atlassian.com/learning/lesson/configure-space-functionality-across-confluence
// Image:   #3, section "Configure security settings for site security and user privacy."
//          https://dam-cdn.atl.orangelogic.com/public/AT16SL0.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SL0'
//
// The lesson shows "Hide external links from search engines" ticked. If the site has it off, the recipe ticks
// it in the form without saving.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages, spotlightAreas } from "../lib/tweaks";

const link = (page: Page) => page.locator(`${adminNav} a[data-testid="securityconfiguration"]`);
const title = (page: Page) => page.locator(`${mainContent} h2`, { hasText: /^Security configuration$/ });
const hideLinks = (page: Page) => page.locator(`${mainContent} input[name="isNofollowExternalLinksEnabled"]`);
const hideLinksText = "Discourages spammers from posting malicious links.";

/** Expands a Settings group in the sidebar (Configuration, Security...) if it is collapsed. */
async function expandGroup(page: Page, name: string) {
  const group = page.locator(`${adminNav} [data-testid="${name}"]`);
  if ((await group.getAttribute("aria-expanded")) !== "true") await group.click();
}

/** A fixed, invisible box around the text of the given elements (not their full width), to outline it. */
async function textArea(page: Page, name: string, selectors: string[]) {
  await page.evaluate(([name, selectors]) => {
    // Each text line and form control inside the elements
    const rects: DOMRect[] = [];
    for (const el of selectors.flatMap((sel) => Array.from(document.querySelectorAll(sel)))) {
      el.querySelectorAll("input, svg").forEach((c) => rects.push(c.getBoundingClientRect()));
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.nodeValue?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...Array.from(range.getClientRects()));
      }
    }
    rects.splice(0, rects.length, ...rects.filter((r) => r.width > 0));
    if (!rects.length) throw new Error(`textArea: nothing visible for ${selectors.join(", ")}`);
    const pad = 8;
    const x = Math.min(...rects.map((r) => r.left)) - pad;
    const y = Math.min(...rects.map((r) => r.top)) - pad;
    const w = Math.max(...rects.map((r) => r.right)) + pad - x;
    const h = Math.max(...rects.map((r) => r.bottom)) + pad - y;
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-tweak", name);
    d.style.cssText = `position:fixed;pointer-events:none;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    document.body.appendChild(d);
  }, [name, selectors] as const);
  return page.locator(`[data-screenshot-tweak="${name}"]`);
}

runRecipe({
  file: "AUC-1706-3",
  assetId: "AT16SL0",
  title: "AUC-1706 #3 - Security configuration, hide external links",
  product: "confluence",

  // Settings > Security > Security configuration, as in the lesson
  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await expandGroup(page, "Security");
    await link(page).click();
    await title(page).waitFor({ timeout: 60_000 });
    await hideLinks(page).waitFor();
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    // The lesson shows the option ticked; tick it in the form if needed (never saved)
    if (!(await hideLinks(page).isChecked())) await hideLinks(page).check();
    // Lesson sidebar: Configuration and Security expanded, Settings heading just below the sidebar header
    await expandGroup(page, "Configuration");
    await page.mouse.move(1270, 790);
    await page.locator("#admin-side-nav-settings-heading").evaluate((el) => {
      const nav = el.closest<HTMLElement>('[data-testid="side-navigation-content"]')!;
      nav.scrollTop += el.getBoundingClientRect().top - 128;
    });
    await page.waitForTimeout(500);
    // Outline the selected sidebar item and the option with its description
    const option = page.locator(`${mainContent} label`, { has: hideLinks(page) }).or(page.locator(`${mainContent} label[id^="isNofollowExternalLinksEnabled"]`)).first();
    const optionId = await option.getAttribute("id");
    await page.getByText(hideLinksText).first().evaluate((el) => el.closest("div, p")!.setAttribute("data-screenshot-target", "hide-links-help"));
    const area = await textArea(page, "hide-links-area", [`[id="${optionId}"]`, '[data-screenshot-target="hide-links-help"]']);
    await spotlightAreas(page, [link(page), area]);
  },

  async checks(page, c) {
    await c.check("Page title reads 'Security configuration'", async () => {
      const t = await title(page).isVisible();
      return { pass: t, detail: t ? "Present" : `Not found; headings: ${(await page.locator(`${mainContent} h2`).allInnerTexts()).join(", ")}` };
    });

    await c.check("Security configuration is selected in the sidebar under Settings > Security", async () => {
      const current = await link(page).getAttribute("aria-current");
      return { pass: current === "page", detail: current === "page" ? "Selected" : "Not the selected item" };
    });

    await c.check("Security group: Security configuration, Global permissions, Roles central, Space permissions, Analytics permissions", async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Security");
      const end = labels.indexOf("Permissions");
      return sameOrder(start >= 0 && end > start ? labels.slice(start + 1, end) : [], [
        "Security configuration", "Global permissions", "Roles central", "Space permissions", "Analytics permissions",
      ]);
    });

    await c.check("Sections in order: Basic, Advanced", async () => {
      // Visible headings only (the advanced configuration is collapsed)
      const h3 = await page.locator(`${mainContent} h3`).evaluateAll((els) =>
        els.filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e as HTMLElement).innerText.trim()),
      );
      return sameOrder(h3, ["Basic", "Advanced"]);
    });

    await c.check("Basic options: Hide personal data in analytics, Hide external links from search engines", async () => {
      // Visible options above the Advanced heading
      const labels = await page.locator(`${mainContent} label`).evaluateAll((els) => {
        const advanced = Array.from(document.querySelectorAll("#AkMainContent h3")).find((h) => (h as HTMLElement).innerText.trim() === "Advanced");
        const limit = advanced ? advanced.getBoundingClientRect().top : Infinity;
        return els
          .filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().top < limit)
          .map((e) => (e as HTMLElement).innerText.trim())
          .filter(Boolean);
      });
      return sameOrder(labels, ["Hide personal data in analytics", "Hide external links from search engines"]);
    });

    await c.check(`'Hide external links from search engines' is a checkbox with the help text '${hideLinksText} More about external links'`, async () => {
      const box = (await hideLinks(page).getAttribute("type")) === "checkbox";
      const help = await page.getByText(hideLinksText).first().isVisible();
      const more = await page.getByRole("link", { name: /More about external links/ }).isVisible();
      const pass = box && help && more;
      return { pass, detail: pass ? "Present" : `Checkbox ${box ? "ok" : "missing"}, help text ${help ? "ok" : "missing"}, link ${more ? "ok" : "missing"}` };
    });

    await c.check("Advanced: 'These settings can only be changed by members of Atlassian Support.' and 'View advanced configuration'", async () => {
      const text = await page.getByText("These settings can only be changed by members of Atlassian Support.", { exact: true }).isVisible();
      const view = await page.getByRole("button", { name: "View advanced configuration" }).isVisible();
      return { pass: text && view, detail: `Text ${text ? "present" : "not found"}; button ${view ? "present" : "not found"}` };
    });

    await c.check("Save button at the bottom of the page", async () => {
      const save = page.locator(mainContent).getByRole("button", { name: "Save", exact: true });
      const v = await save.isVisible();
      return { pass: v, detail: v ? "Present" : "Not found" };
    });
  },
});
