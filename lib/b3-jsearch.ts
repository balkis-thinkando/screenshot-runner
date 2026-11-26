import { Locator, Page, test } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { closeTours } from "./b2-jira";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "./tweaks";

// Helpers for the batch 3 "jsearch" recipes: JQL search, filters, and the space List, Calendar, Timeline and
// Summary views (AUC-1701, AUC-1727, AUC-1753, AUC-1754, AUC-1755).
//
// Test data used (found Nov 2026, nothing created):
//  - EO (Employee Onboarding, business): the lesson's space. Its dates are in 2024 and 2025, before the range the
//    Timeline can show, so Timeline and Calendar shots use MMC instead.
//  - MMC (M0018 - Museum Communication, team-managed software): Timeline and Calendar views; ten work items dated
//    March to July 2027 under two epics, with "blocks" dependencies (MMC-3 blocks MMC-4, MMC-5, MMC-7).
//  - MC-39 (Marketing Content, business): a work item that "is blocked by" two others (MC-34, MC-26) and has no
//    other links.
//  - Add view (+) menus: PLAT offers List, MCE offers Calendar, LSS25 (Calendar view) offers Summary.
//  - Filter 10368 "High priority To Do items" (shared with a space) for the Filter Subscription dialog.

export const MMC = { key: "MMC", board: 218 };
export const MC39 = { key: "MC-39", summary: "Create webinar videos", blockedBy: ["MC-34", "MC-26"] };
export const SUBSCRIBE_FILTER = { id: 10368, name: "High priority To Do items" };

/** Space views and searches can take minutes to settle on the test site: give these tests 3 minutes. */
export function slowPages() {
  const info = test.info();
  if (info.timeout < 180_000) info.setTimeout(180_000);
}

/** A work item key link in a table or chart (its accessible name can include more than the key). */
export const keyLinks = (page: Page, key: string) => page.locator("a").filter({ hasText: new RegExp(`^${key}$`) });
export const keyLink = (page: Page, key: string) => keyLinks(page, key).first();

/** Space view tabs ("Summary", "List", ...), the "More" tab and the "+" add view button. */
export const spaceNav = (page: Page) => page.locator('nav[aria-label="Space navigation"]');
// The current view's tab is a heading (h2, aria-current="page"), the others are links
const TAB = 'a:visible, [data-testid^="navigation-kit-ui-tab.ui.link-tab"]:visible';
export const viewTab = (page: Page, name: string) => spaceNav(page).locator(TAB).filter({ hasText: new RegExp(`^${name}$`) }).first();
export const addViewButton = (page: Page) => page.locator('[data-testid="navigation-kit-add-tab.ui.trigger"]');
export const addViewOptions = (page: Page) => page.locator('[role="listbox"] [role="option"]');
export const addViewOption = (page: Page, name: string) => addViewOptions(page).filter({ hasText: new RegExp(`^${name}$`) }).first();
/** The details pane of the add view menu (illustration, name, description, Add to navigation). */
export const addViewDetails = (page: Page) => page.locator('[role="region"]').filter({ has: page.getByRole("button", { name: "Add to navigation" }) }).first();
export const addToNavigation = (page: Page) => addViewDetails(page).getByRole("button", { name: "Add to navigation" });

/** Opens a space view page and waits for the view tabs and the given content. */
export async function openSpaceView(page: Page, s: Settings, path: string, ready: Locator, what: string) {
  slowPages();
  await openSignedIn(page, s, path);
  await addViewButton(page).waitFor({ timeout: 90_000 }).catch(() => {});
  if (!(await addViewButton(page).isVisible())) {
    const missing = await page.getByText(/can't find|doesn't exist|don't have (access|permission)/i).first().isVisible().catch(() => false);
    if (missing) throw new Blocked(`Test data: the test account cannot open ${what}`);
    throw new Error(`${what} did not load`);
  }
  await ready.waitFor({ timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeTours(page);
}

/**
 * Opens the add view (+) menu and shows `name` as the chosen view, display only. The test account must never add a
 * view, and choosing an option in the menu is a step towards that, so nothing in the menu is clicked: the pointer
 * rests on the option (its real hover style), the option takes the selected style of the first one, and the details
 * pane shows the option's name and the lesson's description. The illustration stays the first option's.
 */
export async function showAddViewOption(page: Page, name: string, description: string) {
  await addViewButton(page).click();
  await addViewOptions(page).first().waitFor({ timeout: 15_000 });
  const option = addViewOption(page, name);
  if (!(await option.isVisible().catch(() => false))) return false;
  await option.hover();
  await page.waitForTimeout(800);
  await page.evaluate(([name, description]) => {
    const opts = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]'));
    const selected = opts.find((o) => o.getAttribute("aria-selected") === "true");
    const target = opts.find((o) => o.innerText.trim() === name);
    if (selected && target && selected !== target) {
      const cls = selected.className;
      selected.className = target.className;
      target.className = cls;
      selected.setAttribute("aria-selected", "false");
      target.setAttribute("aria-selected", "true");
      target.setAttribute("data-screenshot-fake", "selected-view");
    }
    const heading = document.querySelector('[data-testid="navigation-kit-add-tab.ui.content.details.tab-details.heading"]');
    if (heading) {
      heading.textContent = name;
      const desc = heading.nextElementSibling as HTMLElement | null;
      if (desc) desc.textContent = description;
    }
  }, [name, description] as const);
  return true;
}

/** The lesson descriptions of the views in the add view menu. */
export const VIEW_DESCRIPTIONS: Record<string, string> = {
  List: "Get a list of your team's work in a spreadsheet-like table.",
  Calendar: "See when work is due and get a quick glance at what the next month looks like.",
  Summary: "Get an overview of work progress, priorities, workload distribution, and other projects.",
};

/** Names of the visible view tabs (not those under "More"). */
export async function visibleTabs(page: Page) {
  const names = (await spaceNav(page).locator(TAB).allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
  return Array.from(new Set(names));
}

/** Hides the Jira sidebar, display only (the lesson images of space views show it collapsed). */
export async function hideJiraSidebar(page: Page) {
  await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Sidebar"]');
    if (nav) nav.style.display = "none";
    const root = document.querySelector<HTMLElement>("#unsafe-design-system-page-layout-root");
    if (root) root.style.gridTemplateColumns = `0px 0px ${innerWidth}px 0px`;
  });
  await page.waitForTimeout(1_500);
}

/**
 * Replaces the names of the people in the given spaces (assignees, reporters, assignable people) with fake names,
 * display only, the same fake for the same person, plus the signed-in user and avatars. Names come from the REST API
 * in the page and are never printed. Use for screens where names are plain text (List, Timeline, Calendar, Summary).
 */
export async function fakeSpacePeople(page: Page, s: Settings, projects: string[], me = FAKE_PEOPLE[5]) {
  await renameOrg(page, s.test_org, s.display_org_name);
  await fakeSignedInUser(page, me);
  const others = FAKE_PEOPLE.filter((n) => n !== me);
  await page.evaluate(async ([projects, people]) => {
    const names = new Set<string>();
    for (const p of projects) {
      const users = await fetch(`/rest/api/3/user/assignable/search?project=${p}&maxResults=200`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      for (const u of users as { displayName?: string }[]) if (u.displayName) names.add(u.displayName);
      const res = await fetch(`/rest/api/3/search/jql?jql=${encodeURIComponent(`project = "${p}"`)}&fields=assignee,reporter&maxResults=100`)
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      for (const i of res?.issues ?? []) for (const f of ["assignee", "reporter"]) if (i.fields?.[f]?.displayName) names.add(i.fields[f].displayName);
    }
    // Only full names (two words or more); "Former user" and "Unassigned" stay
    const real = Array.from(names).filter((n) => /\S+\s+\S+/.test(n) && !/^(Former user|Automation for Jira)/.test(n));
    // Longest first, so "Ann Lee Smith" is replaced before "Ann Lee"
    real.sort((a, b) => b.length - a.length);
    const map = new Map(real.map((n, i) => [n, people[i % people.length]]));
    const firsts = new Map(real.map((n) => [n.split(/\s+/)[0], map.get(n)!.split(" ")[0]]));
    const swap = (v: string) => {
      for (const [n, f] of map) v = v.split(n).join(f);
      return v;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue) continue;
      let v = swap(n.nodeValue);
      // Truncated names ("Ann Le...") and first names alone, in short labels only
      const t = v.trim();
      if (t.length < 30) {
        const first = t.split(/\s+/)[0];
        if (firsts.has(first) && !Array.from(map.values()).includes(t)) v = v.replace(first, firsts.get(first)!).replace(/\s\S+(…|\.\.\.)$/, "$1");
      }
      n.nodeValue = v;
    }
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
  }, [projects, others] as const);
  const initials = me.split(" ").map((w) => w[0]).join("");
  await anonymize(page, initials, FAKE_PEOPLE);
}

/** Expands the hierarchy rows (epics) of a List or Timeline table whose keys are given. */
export async function expandRows(page: Page, keys: string[]) {
  for (const key of keys) {
    const row = page.locator('[role="row"], tr').filter({ has: keyLinks(page, key) }).first();
    const btn = row.locator('[data-testid="issue-table-hierarchy.ui.expand-button.expand-button"], button[aria-expanded="false"]').first();
    if (!(await btn.isVisible().catch(() => false))) continue;
    if ((await btn.getAttribute("aria-expanded")) === "true") continue;
    await btn.click();
    await page.waitForTimeout(1_500);
  }
}

/** Scrolls the Timeline chart so the month with this header label (e.g. "February '27") is at its left edge. */
export async function scrollTimelineTo(page: Page, month: string) {
  const sc = page.locator('[data-testid="scroll-container.scroll-container"]');
  await sc.waitFor({ timeout: 30_000 });
  const ok = await sc.evaluate(async (el, month) => {
    const find = () => Array.from(el.querySelectorAll("small")).find((s) => (s.textContent ?? "").trim() === month);
    let label = find();
    // Months are drawn lazily: sweep the range until the label exists
    for (let x = 0; !label && x < el.scrollWidth; x += el.clientWidth / 2) {
      el.scrollLeft = x;
      await new Promise((r) => setTimeout(r, 150));
      label = find();
    }
    if (!label) return false;
    // The month's column starts at the left of its header cell
    const cell = (label.closest("div") ?? label) as HTMLElement;
    const chartLeft = el.getBoundingClientRect().left;
    // The list part of the view (Work, Status, Assignee) covers the left of the scroll area
    const list = document.querySelector<HTMLElement>('[data-testid="chart-overlays.static-column"]');
    const listRight = list ? list.getBoundingClientRect().right : chartLeft;
    el.scrollLeft += cell.getBoundingClientRect().left - listRight;
    return true;
  }, month);
  await page.waitForTimeout(1_500);
  return ok;
}

/** Today / Weeks / Months / Quarters switch at the bottom of the Timeline. */
export const timelineModes = (page: Page) =>
  page.getByRole("button", { name: "Months", exact: true }).or(page.getByRole("radio", { name: "Months", exact: true })).first().locator("xpath=ancestor::*[.//*[normalize-space()='Today']][1]");

/** Calendar date controls (Today, previous, month, next) and the Unscheduled work toggle. */
export const calendarToday = (page: Page) => page.locator('[data-testid="calendar.ui.calendar-top-controls-bar.date-controls.today"]');
export const calendarNext = (page: Page) => page.locator('[data-testid="calendar.ui.calendar-top-controls-bar.date-controls.next"]');
export const calendarRange = (page: Page) => page.locator('[data-testid="calendar.ui.calendar-top-controls-bar.view-range-controls.dropdown-menu--trigger"]');
export const unscheduledToggle = (page: Page) => page.locator('[data-testid="calendar.ui.calendar-top-controls-bar.calendar-unscheduled-panel-toggle.button"]');
export const viewSettings = (page: Page) => page.locator('[data-testid="software-view-settings.ui.view-settings-button.responsive-button"]');
export const unscheduledPanel = (page: Page) =>
  page.getByRole("heading", { name: "Unscheduled work" }).locator("xpath=ancestor::*[.//input][1]");

/**
 * Opens the MMC Calendar (sidebar hidden) on March 2027 (its work items' month) and shows or hides the Unscheduled work panel.
 * The panel is a view toggle, not saved content.
 */
export async function openMmcCalendar(page: Page, s: Settings, panel: boolean) {
  await openSpaceView(page, s, `/jira/software/projects/MMC/boards/${MMC.board}/calendar?date=2027-03-01`, calendarToday(page), "the MMC Calendar");
  await hideJiraSidebar(page);
  await page.getByText("MMC-3", { exact: false }).first().waitFor({ timeout: 30_000 });
  const open = await page.getByRole("heading", { name: "Unscheduled work" }).isVisible().catch(() => false);
  if (open !== panel) {
    await unscheduledToggle(page).click();
    await page.waitForTimeout(2_000);
  }
}

/** The month shown by the Calendar ("Mar 2027"). */
export async function calendarMonth(page: Page) {
  const label = page.getByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/).first();
  return (await label.innerText({ timeout: 5_000 }).catch(() => "")).replace(/\s+/g, " ").trim();
}

/** Opens the MMC Timeline (sidebar hidden) with both epics expanded and the chart from February 2027. */
export async function openMmcTimeline(page: Page, s: Settings) {
  await openSpaceView(page, s, `/jira/software/projects/MMC/boards/${MMC.board}/timeline`, keyLink(page, "MMC-1"), "the MMC Timeline");
  // Before scrolling: hiding the sidebar widens the chart
  await hideJiraSidebar(page);
  await expandRows(page, ["MMC-1", "MMC-2"]);
  await keyLink(page, "MMC-7").waitFor({ timeout: 15_000 });
  if (!(await scrollTimelineTo(page, "February '27"))) throw new Error("Timeline has no February '27 column");
}

/** The Filters section of the All work sidebar (heading button and the Search work items link). */
export const sidebarFilters = (page: Page) => page.locator('[data-testid="NAV4_jira.sidebar.filters"]');
export const sidebarSearchItems = (page: Page) => page.locator('nav[aria-label="Sidebar"] a').filter({ hasText: /^Search work items$/ }).first();
/** Recently viewed filters and spaces in the sidebar: they change with the account's history. */
export const sidebarRecent = (page: Page) => [
  page.locator('[data-testid^="NAV4_filt_"]:not([data-testid="NAV4_filt-view-all"])'),
  page.locator('[data-testid$="recent-section"]'),
];

/** The JQL editor and its autocomplete list. */
export const jqlEditor = (page: Page) => page.locator('[data-testid="jql-editor-input"]');
export const jqlAutocomplete = (page: Page) => page.locator('[data-testid="jql-editor-autocomplete"]');

/**
 * All work with a JQL query, in the JQL view. Like openJqlSearch() in lib/jira.ts, but waits for the count text or
 * a result row (the count's test id is not always rendered).
 */
export async function openJql(page: Page, s: Settings, jql: string) {
  slowPages();
  await openSignedIn(page, s, `/issues/?jql=${encodeURIComponent(jql)}`);
  const error = page.getByText(/JQL error|does not exist/);
  await page.getByText(/^\d+ of \d+\+?$/).or(page.locator("table tbody tr")).or(error).first().waitFor({ timeout: 90_000 });
  if (await error.first().isVisible().catch(() => false)) throw new Error(`Search failed: ${(await error.first().innerText()).slice(0, 200)}`);
  const jqlToggle = page.locator('[data-testid="issue-navigator.ui.refinement-bar.search-mode-switcher.toggle-button.advanced"]');
  // The switch can ignore a click while the page is still settling: try again
  for (let i = 0; i < 3 && !(await jqlEditor(page).isVisible().catch(() => false)); i++) {
    await jqlToggle.click().catch(() => {});
    await jqlEditor(page).waitFor({ timeout: 10_000 }).catch(() => {});
  }
  await jqlEditor(page).waitFor({ timeout: 10_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await closeTours(page);
}

/** Checks shared by the space view recipes: the view tab is selected and the expected tabs are there. */
export async function tabsCheck(page: Page, c: import("./recipe").Checks, current: string, lesson: string[]) {
  await c.check(`View tabs with ${current} selected (lesson: ${lesson.join(", ")})`, async () => {
    const tabs = await visibleTabs(page);
    const cur = await viewTab(page, current).getAttribute("aria-current", { timeout: 3_000 }).catch(() => null);
    const more = await spaceNav(page).locator('[data-testid="navigation-kit-ui-tab-list.ui-more-trigger.more-tab"], [data-testid="navigation-kit-ui-tab-list.ui.more-trigger.more-tab"]').first().isVisible().catch(() => false);
    const plus = await addViewButton(page).isVisible();
    const missing = lesson.filter((t) => !tabs.includes(t));
    return {
      pass: !!cur && cur !== "false" && plus,
      detail: `Tabs: ${tabs.join(", ")}${missing.length ? ` (not shown: ${missing.join(", ")}, site data)` : ""}; ${current} selected: ${cur}; More: ${more}; +: ${plus}`,
    };
  });
}

/** The toolbar of the List view: AI, Search, people filter, Filter, Group, and the more (...) button. */
export async function listToolbarCheck(page: Page, c: import("./recipe").Checks) {
  await c.check("Toolbar: AI, Search work, people avatars, Filter, Group, more actions", async () => {
    const ai = await page.getByRole("button", { name: /^(Ask )?AI$/ }).first().isVisible().catch(() => false);
    const search = await page.getByPlaceholder(/Search/).first().isVisible().catch(() => false);
    const avatars = await page.locator('[data-testid^="filters.ui.filters.assignee"]').first().isVisible().catch(() => false);
    const filter = await page.getByRole("button", { name: /^Filter/ }).first().isVisible().catch(() => false);
    const group = await page.getByRole("button", { name: /^Group/ }).first().isVisible().catch(() => false);
    const ok = ai && search && avatars && filter && group;
    return { pass: ok, detail: `AI: ${ai}; search: ${search}; people: ${avatars}; Filter: ${filter}; Group: ${group}` };
  });
}

/** Column headers of a List view table (first line of each, "Configure columns" dropped). */
export async function listColumns(page: Page) {
  // A header cell can start with a hidden button label ("Expand parent work items")
  return (await page.locator("table thead th").allInnerTexts())
    .map((t) => t.split("\n").map((l) => l.trim()).filter((l) => l && !/^(Configure|Expand|Collapse|Sort)/.test(l))[0] ?? "")
    .filter(Boolean);
}

/** Checks shared by the add view (+) menu recipes. `wanted` must be offered; `lesson` lists the lesson's options. */
export async function addViewChecks(page: Page, c: import("./recipe").Checks, wanted: string, offered: boolean, lesson: string[]) {
  await c.check(`Add view (+) menu open with 'Views' and ${wanted} offered`, async () => {
    const items = (await addViewOptions(page).allInnerTexts()).map((t) => t.trim());
    const views = await page.getByText("Views", { exact: true }).first().isVisible().catch(() => false);
    const missing = lesson.filter((l) => !items.includes(l));
    return {
      pass: offered && views,
      detail: `Options: ${items.join(", ")}${offered ? "" : ` (test data: this space already has ${wanted})`}${missing.length ? `; lesson options not offered here: ${missing.join(", ")}` : ""}`,
    };
  });

  await c.check(`Details pane: illustration, ${wanted}, description and Add to navigation (not clicked)`, async () => {
    const pane = addViewDetails(page);
    const img = await pane.locator("img").first().isVisible().catch(() => false);
    const btn = await addToNavigation(page).isVisible().catch(() => false);
    const title = (await page.locator('[data-testid="navigation-kit-add-tab.ui.content.details.tab-details.heading"]').innerText().catch(() => "")).trim();
    return { pass: img && btn && title === wanted, detail: `Illustration: ${img}; heading: "${title}" (display only); Add to navigation: ${btn}` };
  });
}

/** Checks shared by the MMC Timeline recipes. */
export async function timelineChecks(page: Page, c: import("./recipe").Checks) {
  await c.check("Toolbar: Search timeline, people avatars, Filter; view settings, more actions", async () => {
    const search = await page.getByPlaceholder(/Search timeline/).first().isVisible().catch(() => false);
    const avatars = await page.locator('[data-testid^="filters.ui.filters.assignee"]').first().isVisible().catch(() => false);
    const filter = await page.getByRole("button", { name: /^Filter/ }).first().isVisible().catch(() => false);
    const settings = await viewSettings(page).or(page.getByRole("button", { name: /View settings/ })).first().isVisible().catch(() => false);
    const group = await page.getByRole("button", { name: /^Group/ }).first().isVisible().catch(() => false);
    return {
      pass: search && avatars && filter && settings,
      detail: `Search: ${search}; people: ${avatars}; Filter: ${filter}; view settings: ${settings}${group ? "; Group button shown (not in the lesson)" : ""}`,
    };
  });

  await c.check("List columns: Work, Status, Assignee", async () => {
    const text = await page.locator('[data-testid="chart-overlays.static-column"]').locator("xpath=..").innerText().catch(() => "");
    const all = await page.locator("body").innerText();
    const missing = ["Work", "Status", "Assignee"].filter((t) => !new RegExp(`(^|\\n)${t}(\\n|$)`).test(all));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : `All present${text ? "" : ""}` };
  });

  await c.check("Epics expanded with child work items (MMC-3 to MMC-10)", async () => {
    const missing = [];
    for (let i = 1; i <= 10; i++) if (!(await keyLink(page, `MMC-${i}`).first().isVisible().catch(() => false))) missing.push(`MMC-${i}`);
    return { pass: !missing.length, detail: missing.length ? `Not visible: ${missing.join(", ")}` : "All visible" };
  });

  await c.check("Month columns and bars in the chart, with dependency lines", async () => {
    const months = (await page.locator('[data-testid="scroll-container.scroll-container"] small').allInnerTexts()).filter(Boolean);
    const lines = await page.locator('[data-testid="dependencies.overlay"] path, [data-testid="dependencies.overlay"] line').count();
    return { pass: months.length > 0 && lines > 0, detail: `Month headers: ${months.slice(0, 6).join(", ")}; dependency line parts: ${lines}` };
  });

  await c.check("Today, Weeks, Months (selected), Quarters", async () => {
    const all = await page.locator("body").innerText();
    const missing = ["Today", "Weeks", "Months", "Quarters"].filter((t) => !all.includes(t));
    const months = page.getByRole("button", { name: "Months", exact: true }).or(page.getByRole("radio", { name: "Months", exact: true })).first();
    const on = (await months.getAttribute("aria-pressed").catch(() => null)) ?? (await months.getAttribute("aria-checked").catch(() => null));
    return { pass: !missing.length && on === "true", detail: `Missing: ${missing.join(", ") || "none"}; Months selected: ${on}` };
  });

  await c.check("Create row under the list", async () => {
    const create = await page.getByRole("button", { name: "Create", exact: true }).last().isVisible().catch(() => false);
    return { pass: create, detail: create ? "Present" : "Missing" };
  });
}

/** Checks shared by the MMC Calendar recipes. */
export async function calendarChecks(page: Page, c: import("./recipe").Checks) {
  await c.check("Toolbar: Search calendar, people avatars, Filter", async () => {
    const search = await page.getByPlaceholder(/Search calendar/).first().isVisible().catch(() => false);
    const avatars = await page.locator('[data-testid^="filters.ui.filters.assignee"]').first().isVisible().catch(() => false);
    const filter = await page.getByRole("button", { name: /^Filter/ }).first().isVisible().catch(() => false);
    return { pass: search && avatars && filter, detail: `Search: ${search}; people: ${avatars}; Filter: ${filter}` };
  });

  await c.check("Date controls: Today, previous, month, next, Month; Unscheduled work and View settings buttons", async () => {
    const t = await calendarToday(page).isVisible().catch(() => false);
    const n = await calendarNext(page).isVisible().catch(() => false);
    const range = (await calendarRange(page).innerText().catch(() => "")).trim();
    const u = await unscheduledToggle(page).isVisible().catch(() => false);
    const v = await viewSettings(page).isVisible().catch(() => false);
    const month = await calendarMonth(page);
    return { pass: t && n && range === "Month" && u && v, detail: `Today: ${t}; next: ${n}; range: "${range}"; month: "${month}"; Unscheduled work: ${u}; View settings: ${v}` };
  });

  await c.check("Month grid Mon to Fri with work items as bars (MMC-3 ... )", async () => {
    const all = await page.locator("body").innerText();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"].filter((d) => new RegExp(`(^|\\n)${d}(\\n|$)`).test(all));
    const items = (all.match(/MMC-\d+/g) ?? []).length;
    return { pass: days.length === 5 && items > 0, detail: `Day headers: ${days.join(", ")}; work item bars: ${items}` };
  });
}

/**
 * An invisible box over the given page area, for spotlightAreas() when the lesson outlines a region that is not one
 * element (e.g. part of a column). `rect` runs in the page (with `arg`) and returns the area in viewport pixels.
 */
type Rect = { left: number; top: number; right: number; bottom: number };
export async function markBox(page: Page, name: string, rect: (arg: string) => Rect | null, arg = "") {
  const r = await page.evaluate(rect, arg);
  if (!r) throw new Error(`markBox: area "${name}" not found`);
  await page.evaluate(([name, r]) => {
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-area", name);
    d.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.right - r.left}px;height:${r.bottom - r.top}px;pointer-events:none`;
    document.body.appendChild(d);
  }, [name, r] as const);
  return page.locator(`[data-screenshot-area="${name}"]`);
}
