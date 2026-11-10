// Lesson:  AUC-1706 - Configure space functionality across Confluence
//          https://community.atlassian.com/learning/lesson/configure-space-functionality-across-confluence
// Image:   #1, section "Configure the general Confluence setup for your site."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/q6i1f0pl7ale5uwq14cy4j6q82iov8y5.png
// Recipe:  public.screenshot_recipes where asset_id = 'q6i1f0pl7ale5uwq14cy4j6q82iov8y5'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, arrowTo, hideMessages, spotlightAreas } from "../lib/tweaks";

const link = (page: Page) => page.locator(`${adminNav} a[data-testid="generalconfiguration"]`);
const title = (page: Page) => page.locator(`${mainContent} h2`, { hasText: /^General configuration$/ });

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

runRecipe({
  file: "AUC-1706-1",
  assetId: "q6i1f0pl7ale5uwq14cy4j6q82iov8y5",
  title: "AUC-1706 #1 - General configuration",
  product: "confluence",

  // Settings > Configuration > General configuration, as in the lesson
  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    if (!(await link(page).isVisible())) await page.locator(`${adminNav} [data-testid="Configuration"]`).click();
    await link(page).click();
    await title(page).waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  },

  async tweak(page) {
    // Keep the pointer off the sidebar (a hovered item is shaded)
    await page.mouse.move(1270, 790);
    await hideMessages(page, ["Your site now has roles"]);
    // The "Roles are now available" banner (hideMessages would also catch the page around it)
    await page.locator('[data-testid="ga-space-roles-banner"]').evaluateAll((els) =>
      els.forEach((el) => ((el.parentElement ?? (el as HTMLElement)).style.display = "none")),
    );
    await anonymize(page);
    // Sidebar scrolled so the Settings heading sits near the top, as in the lesson
    await page.locator("#admin-side-nav-settings-heading").evaluate((el) => {
      const nav = el.closest<HTMLElement>('[data-testid="side-navigation-content"]')!;
      nav.scrollTop += el.getBoundingClientRect().top - 146;
    });
    await page.waitForTimeout(500);
    // Outline the selected sidebar item and the page content (from the title to the bottom of the window)
    const h = (await title(page).boundingBox())!;
    const content = await areaBox(page, "general-configuration-area", { x: h.x - 20, y: h.y - 20, width: h.width + 40, height: 800 - 20 - (h.y - 20) });
    await spotlightAreas(page, [link(page), content]);
    await arrowTo(page, content, { offsetY: 40 });
  },

  // The form shows the site's own values (title, message, landing page)
  mask: (page) => [page.locator(`${mainContent} input, ${mainContent} textarea`)],

  async checks(page, c) {
    await c.check("Page title reads 'General configuration'", async () => {
      const t = await title(page).isVisible();
      return { pass: t, detail: t ? "Present" : `Not found; headings: ${(await page.locator(`${mainContent} h2`).allInnerTexts()).join(", ")}` };
    });

    await c.check("General configuration is selected in the sidebar under Settings > Configuration", async () => {
      const current = await link(page).getAttribute("aria-current");
      return { pass: current === "page", detail: current === "page" ? "Selected" : "Not the selected item" };
    });

    await c.check(
      "Configuration group: General configuration, New features, Notifications, Shortcut links, Global templates and blueprints, PDF export language support, Configure code macro",
      async () => {
        const labels = await adminNavLabels(page);
        const start = labels.indexOf("Configuration");
        const end = labels.indexOf("Security");
        return sameOrder(start >= 0 && end > start ? labels.slice(start + 1, end) : [], [
          "General configuration", "New features", "Notifications", "Shortcut links", "Global templates and blueprints",
          "PDF export language support", "Configure code macro",
        ]);
      },
    );

    await c.check("First section is 'Confluence setup'", async () => {
      const first = (await page.locator(`${mainContent} h3`).first().innerText()).trim();
      return { pass: first === "Confluence setup", detail: `"${first}"` };
    });

    await c.check(
      "Confluence setup starts with: Confluence title, Display this title on the navigation bar, Favicon, Contact administrators message",
      async () => {
        const labels = (await page.locator(`${mainContent} form label`).allInnerTexts()).map((t) => t.replace(/\*\s*$/, "").trim()).filter(Boolean);
        return sameOrder(labels.slice(0, 4), ["Confluence title", "Display this title on the navigation bar", "Favicon", "Contact administrators message"]);
      },
    );

    await c.check("Favicon has a 'Select file to upload' drop area", async () => {
      const v = await page.getByRole("button", { name: "Select file to upload" }).isVisible();
      return { pass: v, detail: v ? "Present" : "Not found" };
    });
  },
});
