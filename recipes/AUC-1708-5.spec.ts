// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #5, section "Enable anonymous access across your Confluence site."
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT16SPV.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT16SPV'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages } from "../lib/tweaks";

const securityItems = ["Security configuration", "Public links", "Anonymous access", "JSM access", "Teams settings"];
const LESSON_INTRO =
  "By enabling anonymous access on this site, you or any space admin will be able to make any space on this site accessible to anyone on the internet. Anonymous access doesn’t affect your license count.";

const groupButton = (page: Page, name: string) => page.locator(`${adminNav} button[data-testid="${name}"]`);
// The test id holds the current state ("editor-false-useConf...", then "editor-true-useConf..." once ticked)
const checkbox = (page: Page, column: "useConf" | "viewProfile") => page.locator(`[data-testid^="editor-"][data-testid$="-${column}--hidden-checkbox"]`);
const buttons = (page: Page) => page.locator(`${mainContent} [data-testid^="changestager"] button`);
// View mode: one icon per permission ("viewer-true-..." granted, "viewer-false-..." denied)
const viewerIcons = (page: Page) => page.locator(`${mainContent} [data-testid^="viewer-"][data-testid$="-useConf"], ${mainContent} [data-testid^="viewer-"][data-testid$="-viewProfile"]`);

// The lesson image shows the saved result (view mode, both permissions granted). The steps are checked in
// edit mode in navigate(), recorded here, then discarded with Cancel; Save is never selected
const editMode = { ticked: [false, false], buttons: [] as string[], saveEnabled: false };

/** The lesson shows no unread count on the bell; hide the badge (display only). */
async function hideNotificationCount(page: Page) {
  await page.locator('[data-testid="top-nav-notifications-button"]').evaluate((btn) => {
    const scope = btn.parentElement ?? btn;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>("*"))) {
      if (/^\d+\+?$/.test(el.innerText?.trim() ?? "") && !el.querySelector("svg")) el.style.visibility = "hidden";
    }
  });
}

/** Shows both permissions as granted, as in the lesson (display only: the site may have them off). */
async function showGranted(page: Page) {
  await viewerIcons(page).evaluateAll((icons) => {
    for (const icon of icons as HTMLElement[]) {
      icon.style.color = "var(--ds-icon-success, #6A9A23)";
      icon.setAttribute("aria-label", "Permission granted");
      const svg = icon.querySelector("svg");
      if (svg) svg.innerHTML = '<path fill="currentColor" fill-rule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0m3.53 5.47a.75.75 0 0 0-1.06 0L7 8.94 5.53 7.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4-4a.75.75 0 0 0 0-1.06"/>';
    }
  });
}

/** Opens a settings group in the Confluence administration sidebar (display state only). */
async function expandGroup(page: Page, name: string) {
  const button = groupButton(page, name);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

runRecipe({
  file: "AUC-1708-5",
  assetId: "AT16SPV",
  title: "AUC-1708 #5 - Anonymous access enabled",
  product: "confluence",

  async navigate(page, s) {
    // Confluence administration > Security > Anonymous access > Edit
    await openConfluenceAdmin(page, s);
    await expandGroup(page, "Security");
    await page.locator(`${adminNav} a[data-testid="anonymous-access-site-admin"]`).click();
    await page.locator("h1", { hasText: "Anonymous access" }).waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await checkbox(page, "useConf").waitFor({ state: "attached" });
    // Lesson steps in edit mode: tick both checkboxes (staged on the page only)
    for (const column of ["useConf", "viewProfile"] as const) {
      await checkbox(page, column).check();
      await page.waitForTimeout(500);
    }
    editMode.ticked = [await checkbox(page, "useConf").isChecked(), await checkbox(page, "viewProfile").isChecked()];
    editMode.buttons = (await buttons(page).allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    if (!editMode.buttons.length) editMode.buttons = (await page.locator(mainContent).getByRole("button", { name: /^(Cancel|Save|Edit)$/ }).allInnerTexts()).map((t) => t.trim());
    const save = page.locator(mainContent).getByRole("button", { name: "Save", exact: true });
    editMode.saveEnabled = (await save.count()) > 0 && (await save.first().isEnabled());
    // Discard the staged change and go back to view mode
    await page.locator(mainContent).getByRole("button", { name: "Cancel", exact: true }).click();
    await page.locator(mainContent).getByRole("button", { name: "Edit", exact: true }).waitFor();
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await hideNotificationCount(page);
    await showGranted(page);
    // The lesson sidebar shows the end of Configuration and the whole Security group
    // (Permissions is opened too so the sidebar can scroll far enough)
    await expandGroup(page, "Configuration");
    await expandGroup(page, "Permissions");
    await page.waitForTimeout(500);
    await page.locator(`${adminNav} a`, { hasText: "Shortcut links" }).first().evaluate((el) => {
      // Put Shortcut links right below the sticky "Confluence administration" header
      let box = el.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
      if (box) box.scrollTop += el.getBoundingClientRect().top - 108;
    });
    await page.waitForTimeout(500);
    await page.mouse.move(640, 700); // no hover highlight in the sidebar
  },

  // The lesson image shows the top of the page
  clip: { x: 0, y: 0, width: 1280, height: 553 },

  async checks(page, c) {
    await c.check("Page title reads 'Anonymous access'", async () => {
      const h1 = (await page.locator(`${mainContent} h1`).first().innerText()).trim();
      return { pass: h1 === "Anonymous access", detail: `"${h1}"` };
    });

    await c.check(`Security group: ${securityItems.join(", ")}`, async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Security");
      const end = labels.indexOf("Permissions");
      return sameOrder(start >= 0 ? labels.slice(start + 1, end > start ? end : undefined) : [], securityItems);
    });

    await c.check("Intro text reads as in the lesson, with no extra notes", async () => {
      const text = (await page.locator('[data-testid="global-perms-Anonymous-tab"]').innerText()).split("Learn more")[0].replace(/\s+/g, " ").trim();
      return { pass: text === LESSON_INTRO, detail: text === LESSON_INTRO ? "Same text" : `Now: "${text}"` };
    });

    await c.check("Learn more about anonymous access link", async () => {
      const visible = await page.getByRole("link", { name: "Learn more about anonymous access" }).isVisible();
      return { pass: visible, detail: visible ? "Present" : "Not found" };
    });

    await c.check("Table columns: Users, Use Confluence, View User Profile", async () => {
      const heads = (await page.locator(`${mainContent} table th`).allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      return sameOrder(heads, ["Users", "Use Confluence", "View User Profile"]);
    });

    await c.check("One row: Anonymous users, Anyone on the internet", async () => {
      const rows = (await page.locator(`${mainContent} table tbody tr`).allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
      const pass = rows.length === 1 && rows[0] === "Anonymous users Anyone on the internet";
      return { pass, detail: `Rows: ${rows.map((r) => `"${r}"`).join(", ") || "none"}` };
    });

    await c.check("Edit mode: Use Confluence and View User Profile checkboxes can be ticked", async () => {
      const [a, b] = editMode.ticked;
      return { pass: a && b, detail: `Use Confluence ${a ? "ticked" : "not ticked or missing"}, View User Profile ${b ? "ticked" : "not ticked or missing"}` };
    });

    await c.check("Edit mode shows Cancel and Save (Save enabled after ticking)", async () => {
      const { buttons: labels, saveEnabled } = editMode;
      const pass = labels.includes("Cancel") && labels.includes("Save") && saveEnabled;
      return { pass, detail: `Buttons: ${labels.join(", ") || "none"}; Save ${saveEnabled ? "enabled" : "disabled or missing"}` };
    });

    await c.check("View mode: Edit button and one icon per permission", async () => {
      const edit = await page.locator(mainContent).getByRole("button", { name: "Edit", exact: true }).isVisible();
      const icons = await viewerIcons(page).count();
      return { pass: edit && icons === 2, detail: `Edit ${edit ? "present" : "missing"}, ${icons} permission icons` };
    });
  },
});
