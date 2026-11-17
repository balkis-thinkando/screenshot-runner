import { Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, hideMessages, renameOrg } from "./tweaks";

// Helpers for the batch 2 Jira and Jira Service Management recipes (AUC-383, AUC-385, AUC-669, AUC-986).

/**
 * The work item used by all AUC-383 recipes: "New-hire first engagement" in Employee Onboarding, the same item the
 * lesson shows. It has a linked work item (blocks EO-3). Found with JQL `issueLinkType is not EMPTY` (Nov 2026).
 * The test account can move it but not delete or archive it (no Delete/Archive permission in EO).
 */
export const AUC383_WORK_ITEM = "EO-2";
export const AUC383_SUMMARY = "New-hire first engagement";

export const itemHeading = (page: Page) =>
  page.locator('[data-testid="issue.views.issue-base.foundation.summary.heading"]:visible').or(page.locator("h1:visible")).first();
/** The row of small buttons under the work item title ("+" Add or create, apps, AI). */
export const quickAddRow = (page: Page) =>
  quickAddButton(page)
    .or(page.locator('[data-testid="issue-view-foundation.quick-add.quick-add-items-compact.apps-button-dropdown--trigger"]'))
    .or(page.getByRole("button", { name: "Summarize work item" }));
export const quickAddButton = (page: Page) =>
  page.locator('[data-testid="issue-view-foundation.quick-add.quick-add-items-compact.add-button-dropdown--trigger"]');
export const actionsButton = (page: Page) => page.locator('[data-testid="issue-meatball-menu.ui.dropdown-trigger.button"]');
/** The open dropdown menu: the outermost menu around the first visible menu item. */
export const openMenu = (page: Page) =>
  page.locator('[role="menuitem"]:visible').first().locator("xpath=ancestor::*[@role='menu'][last()]");

/** Opens a work item in the full-page view and waits for its title and side panel. */
export async function openWorkItem(page: Page, s: Settings, key: string, summary: string) {
  await openSignedIn(page, s, `/browse/${key}`);
  const heading = itemHeading(page);
  await page.getByRole("heading", { name: summary }).first().waitFor({ timeout: 90_000 }).catch(() => {});
  if (!(await heading.isVisible())) {
    const missing = await page.getByText(/can't find|isn't available|don't have permission/i).first().isVisible().catch(() => false);
    if (missing) throw new Blocked(`Test data: the test account cannot open work item ${key}`);
    throw new Error(`Work item ${key} did not load`);
  }
  const title = (await heading.innerText()).trim();
  if (title !== summary) throw new Blocked(`Test data: ${key} is now "${title.slice(0, 60)}", expected "${summary}"`);
  await page.locator('[data-testid="issue-field-status.ui.status-view.status-button.status-button"]').first().waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeTours(page);
}

/** Closes onboarding pop-ups (feature tours) with Escape; hiding them can leave the page dimmed. */
export async function closeTours(page: Page) {
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

/** Feature tips that pop up next to an open menu (e.g. "Add a cover to your work item"); display only. */
export const hideTips = (page: Page) => hideMessages(page, ["Add a cover to your work item"]);

/**
 * Work item people fields show names in "<name>- edit Assignee" buttons, not profile cards, so fakeProfileNames()
 * misses them. Swaps those names for fake ones (display only), the same fake for the same person.
 * It also neutralises "More information about <field>" help buttons (Start date, Category) and profile cards it has
 * already faked, so fakeProfileNames() afterwards only renames people still real and never renames a field label.
 */
export async function fakeFieldPeople(page: Page, people = FAKE_PEOPLE) {
  await page.evaluate((people) => {
    const neutralise = (done: Set<string>) => {
      const prefix = "More information about ";
      document.querySelectorAll(`[aria-label^="${prefix}"]`).forEach((el) => {
        const who = el.getAttribute("aria-label")!.slice(prefix.length).trim();
        if (done.has(who) || !/^[A-Z][\w'-]+( [A-Z][\w'-]+)+$/.test(who)) el.setAttribute("aria-label", `Details: ${who}`);
      });
    };
    const re = /^(.+?)\s*- edit (Assignee|Reporter|[A-Z][\w ]+)$/;
    const real = Array.from(document.querySelectorAll("[aria-label]"))
      .map((el) => re.exec(el.getAttribute("aria-label") ?? "")?.[1]?.trim())
      .filter((n): n is string => !!n && /^[A-Z][\w'-]+( [A-Z][\w'-]+)+$/.test(n) && !/^Edit /.test(n));
    const names = new Map(Array.from(new Set(real)).map((n, i) => [n, people[i % people.length]]));
    if (!names.size) return neutralise(new Set());
    const swap = (v: string) => { for (const [n, f] of names) v = v.replaceAll(n, f); return v; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
    neutralise(new Set(names.values()));
  }, people);
}

/** The usual Jira tweaks: org name, signed-in user, people, avatars. */
export async function jiraPeopleTweaks(page: Page, s: Settings, me = FAKE_PEOPLE[5]) {
  await renameOrg(page, s.test_org, s.display_org_name);
  await fakeSignedInUser(page, me);
  const others = FAKE_PEOPLE.filter((n) => n !== me);
  await fakeFieldPeople(page, others);
  await fakeProfileNames(page, others);
  const initials = me.split(" ").map((w) => w[0]).join("");
  await anonymize(page, initials, FAKE_PEOPLE);
}

/** Visible texts of the open menu's items, first line only (shortcut hints dropped). */
export async function menuItems(page: Page) {
  return (await openMenu(page).getByRole("menuitem").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
}

/** All work (work item search), switched to the given view. Waits for the result count. */
export async function openAllWork(page: Page, s: Settings, view: "Basic" | "JQL") {
  await openSignedIn(page, s, "/issues/?jql=");
  // The result count or the first result row (the count's test id is not always rendered)
  await page.getByText(/^\d+ of \d+\+?$/).or(page.locator("table tbody tr")).first().waitFor({ timeout: 90_000 });
  const toggle = page.getByRole("button", { name: view, exact: true }).or(page.getByRole("radio", { name: view, exact: true })).first();
  await toggle.click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeTours(page);
}

/** The Basic/JQL switch on All work. */
export const viewSwitch = (page: Page) =>
  page.getByRole("button", { name: "Basic", exact: true }).or(page.getByRole("radio", { name: "Basic", exact: true })).first().locator("xpath=..");

/** Whether the signed-in account has the given Jira permissions in a space (to explain a missing menu item). */
export async function havePermissions(page: Page, projectKey: string, permissions: string[]) {
  return page.evaluate(async ([key, perms]) => {
    const r = await fetch(`/rest/api/3/mypermissions?projectKey=${key}&permissions=${perms.join(",")}`).then((x) => x.json()).catch(() => null);
    return Object.fromEntries(perms.map((p) => [p, r?.permissions?.[p]?.havePermission ?? null])) as Record<string, boolean | null>;
  }, [projectKey, permissions] as const);
}

/** Items of the lesson's More actions menu (AUC-383 #7 and #9, 2026 lesson images). */
export const LESSON_MORE_ACTIONS = [
  "Give feedback", "Log work", "Add flag", "Watch", "Add vote", "Select cover", "Clone", "Move", "Archive", "Delete", "Open command palette",
];

/** The global search dropdown (top bar Search box clicked, nothing typed). */
export const searchDialog = (page: Page) => page.locator('[data-testid="search-dialog"]');
export const QUICK_FILTERS = ["Work items (JQL)", "Boards", "Spaces", "Filters", "Plans", "Teams"];
export const quickFilter = (page: Page, name: string) => searchDialog(page).getByText(name, { exact: true });

/** Opens All work (Basic view, as behind the lesson's dropdown) and clicks the top bar Search box. */
export async function openGlobalSearch(page: Page, s: Settings) {
  await openAllWork(page, s, "Basic");
  await page.locator('[data-testid="atlassian-navigation.ui.search.quickfind-skeleton-wrapper"]').click();
  await quickFilter(page, QUICK_FILTERS[0]).waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

/**
 * The search suggestion row changes with the account's history and often names a person ("Work items assigned to
 * <name> in <space>", sometimes with an avatar). Shows a fixed fake suggestion instead (display only; also masked).
 */
export async function fakeSuggestionName(page: Page, fake = FAKE_PEOPLE[2]) {
  await searchDialog(page).evaluate((el, fake) => {
    const row = Array.from(el.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => /Suggestion\s*$/.test(o.innerText.trim()));
    if (!row) return;
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let first = true;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const v = n.nodeValue?.trim();
      if (!v || v === "Suggestion") continue;
      n.nodeValue = first ? `Work items assigned to ${fake}` : "";
      first = false;
    }
    // Pictures after the leading search icon (app logo, avatar or initials placeholder)
    const pics = Array.from(row.querySelectorAll<HTMLElement>('img, [role="img"], [data-screenshot-tweak], span[style*="border-radius:50%"]'));
    pics.slice(1).forEach((p) => (p.style.display = "none"));
  }, fake);
}

/** Checks shared by the AUC-385 #3 and #4 search dropdown recipes. */
export async function searchDropdownChecks(page: Page, c: import("./recipe").Checks) {
  await c.check("Search dropdown open under the top bar Search box, input focused", async () => {
    const open = await searchDialog(page).isVisible();
    const focused = await page.locator('[data-testid="search-input"]').evaluate((el) => el === document.activeElement).catch(() => false);
    return { pass: open && focused, detail: `Dropdown: ${open}; input focused: ${focused}` };
  });

  await c.check("Filter buttons: filter icon, App, Space, Assignee", async () => {
    const found: string[] = [];
    for (const t of ["App", "Space", "Assignee"])
      if (await searchDialog(page).getByRole("button", { name: t, exact: true }).first().isVisible().catch(() => false)) found.push(t);
    const missing = ["App", "Space", "Assignee"].filter((t) => !found.includes(t));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });

  await c.check("RECENT list of work items", async () => {
    const heading = await searchDialog(page).getByText(/^recent$/i).first().isVisible().catch(() => false);
    const n = await searchDialog(page).locator('[data-testid="search-dialog-result-link"]').count();
    return { pass: heading && n > 0, detail: `RECENT heading: ${heading}; results: ${n} (lesson: 7)` };
  });

  await c.check("Quick filters: Work items (JQL), Boards, Spaces, Filters, Plans, Teams", async () => {
    const missing: string[] = [];
    for (const t of QUICK_FILTERS) if (!(await quickFilter(page, t).first().isVisible().catch(() => false))) missing.push(t);
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });

  await c.check("Footer: Help us improve search, Give feedback, Why has search changed?", async () => {
    const text = await searchDialog(page).innerText();
    const missing = ["Help us improve search", "Give feedback", "Why has search changed?"].filter((t) => !text.includes(t));
    return { pass: !missing.length, detail: missing.length ? `UI change, missing: ${missing.join(", ")}` : "All present" };
  });
}
