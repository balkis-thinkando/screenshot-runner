// Lesson:  AUC-1706 - Configure space functionality across Confluence
//          https://community.atlassian.com/learning/lesson/configure-space-functionality-across-confluence
// Image:   #2, section "Communicate important messages to your users."
//          https://dam-cdn.atl.orangelogic.com/AssetLink/ja8jfk0660jupus884s58c77fs0knbbo.png
// Recipe:  public.screenshot_recipes where asset_id = 'ja8jfk0660jupus884s58c77fs0knbbo'
//
// The form is filled in but never published: the recipe only types into fields and picks a color.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, mainContent, openConfluenceAdmin } from "../lib/confluence";
import { anonymize, hideMessages, spotlightAreas } from "../lib/tweaks";

const link = (page: Page) => page.locator(`${adminNav} a[data-testid="announcement-banner"]`);
const heading = (page: Page, text: string) => page.locator(`${mainContent} h2`, { hasText: new RegExp(`^${text}$`) });
const titleInput = (page: Page) => page.locator(`${mainContent} [data-testid="titleInput"]`);
const messageEditor = (page: Page) => page.locator(`${mainContent} #ak-editor-textarea`);
const color = (page: Page, name: string) => page.locator(`${mainContent} button[aria-label="Background color - ${name}"]`);
const colors = ["gray", "blue", "purple", "green", "yellow", "red"];

const announcementTitle = "Upcoming Town Hall";
const message = "The Town Hall is happening this Friday, May 9 at 12:00 PM! Check out the agenda page here.";

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
  file: "AUC-1706-2",
  assetId: "ja8jfk0660jupus884s58c77fs0knbbo",
  title: "AUC-1706 #2 - Create an announcement (filled in, not published)",
  product: "confluence",

  // Admin tools > Announcements > Create Announcement, as in the lesson
  async navigate(page, s) {
    await openConfluenceAdmin(page, s);
    await link(page).click();
    await page.getByRole("link", { name: "Create Announcement" }).click();
    await titleInput(page).waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    // Fill in the form as in the lesson (typed only; nothing is published)
    await titleInput(page).fill(announcementTitle);
    await messageEditor(page).click();
    await page.keyboard.type(message, { delay: 5 });
    await color(page, "purple").click();
    await page.mouse.move(1270, 790);
    // Scroll so the Title section is at the top, as in the lesson
    await heading(page, "Title").evaluate((el) => {
      const main = el.closest<HTMLElement>("#AkMainContent")!;
      main.scrollTop += el.getBoundingClientRect().top - 70;
    });
    await page.waitForTimeout(500);
    // Outline the selected sidebar item and the form (from Title to the bottom of the window)
    const h = (await heading(page, "Title").boundingBox())!;
    const form = await areaBox(page, "announcement-form-area", { x: h.x - 20, y: h.y - 20, width: h.width + 40, height: 800 - 15 - (h.y - 20) });
    await spotlightAreas(page, [link(page), form]);
  },

  async checks(page, c) {
    await c.check("Announcements is selected in the sidebar under Admin tools", async () => {
      const current = await link(page).getAttribute("aria-current");
      return { pass: current === "page", detail: current === "page" ? "Selected" : "Not the selected item" };
    });

    await c.check("Form sections in order: Title, Display settings, Target Audience, Schedule (optional)", async () => {
      const h2 = (await page.locator(`${mainContent} form h2, ${mainContent} h2`).allInnerTexts()).map((t) => t.trim());
      const expected = ["Title", "Display settings", "Target Audience", "Schedule (optional)"];
      const found = h2.filter((t) => expected.includes(t));
      const pass = JSON.stringify([...new Set(found)]) === JSON.stringify(expected);
      return { pass, detail: `Headings: ${h2.join(", ")}` };
    });

    await c.check("Title: 'Give your announcement a short title to easily reference on the announcements table.'", async () => {
      const v = await page.getByText("Give your announcement a short title to easily reference on the announcements table.", { exact: true }).isVisible();
      return { pass: v, detail: v ? "Present" : "Text not found" };
    });

    await c.check("Field 'Announcement title (required)' accepts the title", async () => {
      const label = await page.getByText("Announcement title (required)", { exact: true }).isVisible();
      const value = await titleInput(page).inputValue();
      const pass = label && value === announcementTitle;
      return { pass, detail: `Label ${label ? "present" : "not found"}; value "${value}"` };
    });

    await c.check("Display settings: 'Create your banner message and select a color.'", async () => {
      const v = await page.getByText("Create your banner message and select a color.", { exact: true }).isVisible();
      return { pass: v, detail: v ? "Present" : "Text not found" };
    });

    await c.check("Display settings shows a banner preview with the typed message", async () => {
      const preview = page.locator(mainContent).getByText(/^The Town Hall is happening this Friday/).first();
      const box = await preview.boundingBox();
      const editor = await messageEditor(page).boundingBox();
      const pass = !!box && !!editor && box.y < editor.y;
      return { pass, detail: box ? (pass ? "Preview above the Message box" : "Message text found, but not as a preview above the Message box") : "No preview found" };
    });

    await c.check("Message (required) box with emoji and link buttons and a character count (n/4000)", async () => {
      const missing: string[] = [];
      if (!(await page.getByText("Message (required)", { exact: true }).isVisible())) missing.push("Message (required) label");
      if (!(await page.getByRole("button", { name: "Insert emoji" }).isVisible())) missing.push("emoji button");
      if (!(await page.getByRole("button", { name: "Insert link" }).isVisible())) missing.push("link button");
      if (!(await page.getByText(/^\d+\/4000$/).first().isVisible())) missing.push("character count");
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check(`Look and feel: six colors (${colors.join(", ")}), purple selected`, async () => {
      const found = await page.locator(`${mainContent} button[aria-label^="Background color - "]`).evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label")!.replace("Background color - ", "")),
      );
      const same = JSON.stringify(found) === JSON.stringify(colors);
      const purple = color(page, "purple");
      const selected = (await purple.getAttribute("aria-pressed")) === "true" || (await purple.locator("svg").count()) > 0;
      return { pass: same && selected, detail: `Colors: ${found.join(", ")}; purple ${selected ? "selected" : "not shown as selected"}` };
    });

    await c.check("Toggle 'Users can dismiss the banner'", async () => {
      const v = await page.getByText("Users can dismiss the banner", { exact: true }).isVisible();
      const toggle = await page.locator(`${mainContent} input[name="isDismissible"]`).count();
      return { pass: v && toggle > 0, detail: v && toggle ? "Present" : "Not found" };
    });

    await c.check("Target Audience has Public and Private; form ends with Publish", async () => {
      const missing: string[] = [];
      if (!(await page.getByText(/^Public:/).count())) missing.push("Public");
      if (!(await page.getByText(/^Private:/).count())) missing.push("Private");
      if (!(await page.getByRole("button", { name: "Publish", exact: true }).count())) missing.push("Publish");
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
