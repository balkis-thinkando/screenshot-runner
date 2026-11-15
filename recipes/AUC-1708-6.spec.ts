// Lesson:  AUC-1708 - Manage access to your Confluence site
//          https://community.atlassian.com/learning/lesson/manage-global-permissions-in-confluence
// Image:   #6, section "Add people to all spaces and manage access"
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12O8NA.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12O8NA'

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { adminNav, adminNavLabels, mainContent, openConfluenceAdmin, sameOrder } from "../lib/confluence";
import { anonymize, hideMessages } from "../lib/tweaks";

const permissionItems = [
  "Site permissions", "Roles central", "Bulk space access", "Space roles", "System operations", "Space defaults",
  "Space management", "Guest access", "App permissions", "Analytics permissions",
];
const WHO = "All Confluence admins";
const ROLE = "Admin";

const groupButton = (page: Page, name: string) => page.locator(`${adminNav} button[data-testid="${name}"]`);
const main = (page: Page) => page.locator(mainContent);
const radios = (page: Page, name: string) => main(page).locator(`input[type="radio"][name="${name}"]`);
const addToAll = (page: Page) => main(page).getByRole("button", { name: "Add to all", exact: true });

/** Opens a settings group in the Confluence administration sidebar (display state only). */
async function expandGroup(page: Page, name: string) {
  const button = groupButton(page, name);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

/** Scrolls the administration sidebar so the given link sits right below its sticky header. */
async function scrollSidebarTo(page: Page, linkText: string) {
  await page.locator(`${adminNav} a`, { hasText: linkText }).first().evaluate((el) => {
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += el.getBoundingClientRect().top - 108;
  });
}

/** The lesson shows no unread count on the bell; hide the badge (display only). */
async function hideNotificationCount(page: Page) {
  await page.locator('[data-testid="top-nav-notifications-button"]').evaluate((btn) => {
    const scope = btn.parentElement ?? btn;
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>("*"))) {
      if (/^\d+\+?$/.test(el.innerText?.trim() ?? "") && !el.querySelector("svg")) el.style.visibility = "hidden";
    }
  });
}

/** Label text next to each radio button of a group, in page order, with the selected one. */
async function radioOptions(page: Page, name: string) {
  return radios(page, name).evaluateAll((els) =>
    els.map((el) => {
      const input = el as HTMLInputElement;
      const label = (input.closest("label")?.innerText ?? document.querySelector(`label[for="${input.id}"]`)?.textContent ?? "").trim();
      return { label, checked: input.checked };
    }),
  );
}

runRecipe({
  file: "AUC-1708-6",
  assetId: "AT12O8NA",
  title: "AUC-1708 #6 - Bulk space access (add people to all spaces)",
  product: "confluence",

  async navigate(page, s) {
    // Confluence administration > Permissions > Bulk space access
    await openConfluenceAdmin(page, s);
    await expandGroup(page, "Permissions");
    await page.locator(`${adminNav} a[data-testid="bulk-space-access-site-admin"]`).click();
    await page.locator("h1", { hasText: "Manage space access in bulk" }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2_000);
  },

  async tweak(page) {
    await hideMessages(page, ["Your site now has roles"]);
    await anonymize(page);
    await hideNotificationCount(page);
    // Fill the form as in the lesson (Who, Role). Nothing is submitted: never select Add to all
    const who = main(page).getByRole("combobox").first();
    await who.click();
    await who.fill(WHO);
    await page.getByRole("option", { name: new RegExp(`^${WHO}`) }).first().click({ timeout: 15_000 });
    // The role picker's input sits off-screen inside the select; open it with the keyboard
    const role = main(page).locator("#role-selector");
    await role.focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("option", { name: new RegExp(`^${ROLE}\\b`) }).first().click({ timeout: 15_000 });
    // The lesson sidebar shows the end of Security and the whole Permissions group
    await expandGroup(page, "Security");
    await page.waitForTimeout(500);
    await scrollSidebarTo(page, "Anonymous access");
    await page.mouse.move(1000, 700); // no hover highlight
    await page.waitForTimeout(500);
  },

  async checks(page, c) {
    await c.check("Page title reads 'Manage space access in bulk'", async () => {
      const h1 = (await main(page).locator("h1").first().innerText()).trim();
      return { pass: h1 === "Manage space access in bulk", detail: `"${h1}"` };
    });

    await c.check(`Permissions group: ${permissionItems.join(", ")}`, async () => {
      const labels = await adminNavLabels(page);
      const start = labels.indexOf("Permissions");
      const end = labels.indexOf("Look and feel");
      return sameOrder(start >= 0 ? labels.slice(start + 1, end > start ? end : undefined) : [], permissionItems);
    });

    await c.check("Form sections: Who, Action to perform, On which spaces, With what access", async () => {
      const text = await main(page).innerText();
      const expected = ["Who", "Action to perform", "On which spaces", "With what access"];
      const at = expected.map((t) => text.indexOf(t));
      const pass = at.every((i) => i >= 0) && at.every((i, n) => n === 0 || i > at[n - 1]);
      return { pass, detail: pass ? "All present, same order" : `Missing or out of order: ${expected.filter((_, n) => at[n] < 0).join(", ") || "order differs"}` };
    });

    await c.check(`Who: '${WHO}' can be selected`, async () => {
      const text = (await main(page).innerText()).includes(WHO);
      return { pass: text, detail: text ? "Selected" : "Not found in the Who picker" };
    });

    await c.check("Action to perform: Add or change access (selected), Remove access", async () => {
      const opts = await radioOptions(page, "action-selection");
      const r = sameOrder(opts.map((o) => o.label), ["Add or change access", "Remove access"]);
      const pass = r.pass && opts[0].checked;
      return { pass, detail: pass ? "Same options, first selected" : `${r.detail} Selected: ${opts.find((o) => o.checked)?.label ?? "none"}` };
    });

    await c.check("On which spaces: All, All (excluding personal) (selected), Only personal", async () => {
      const opts = await radioOptions(page, "space-selection");
      const r = sameOrder(opts.map((o) => o.label), ["All", "All (excluding personal)", "Only personal"]);
      const pass = r.pass && !!opts[1]?.checked;
      return { pass, detail: pass ? "Same options, second selected" : `${r.detail} Selected: ${opts.find((o) => o.checked)?.label ?? "none"}` };
    });

    await c.check(`With what access: Role picker offers '${ROLE}'`, async () => {
      const all = await main(page).innerText();
      const text = all.slice(all.indexOf("\nRole\n") + 6, all.indexOf("This will overwrite")).trim();
      const pass = text === ROLE;
      return { pass, detail: pass ? `${ROLE} selected` : `Role field shows "${text}"` };
    });

    await c.check("Warning: This will overwrite any existing access they have. This can't be undone", async () => {
      const visible = await main(page).getByText(/This will overwrite any existing access they have\. This can.t be undone/).first().isVisible();
      return { pass: visible, detail: visible ? "Present" : "Not found" };
    });

    await c.check("Add to all button (enabled once the form is filled)", async () => {
      const button = addToAll(page);
      const there = (await button.count()) > 0;
      const enabled = there && (await button.isEnabled());
      return { pass: enabled, detail: there ? (enabled ? "Present, enabled (not selected)" : "Present, disabled") : "Not found" };
    });
  },
});
