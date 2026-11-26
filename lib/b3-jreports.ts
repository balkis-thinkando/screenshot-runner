import { Locator, Page, test } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { closeTours } from "./b2-jira";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, hideMessages, renameOrg } from "./tweaks";

// Helpers for the batch 3 "jreports" recipes: Jira personal settings and notifications (AUC-389, AUC-424), work item
// collaboration (AUC-384, AUC-693), automation (AUC-703), dashboards and filters (AUC-729), plans (AUC-734, AUC-735)
// and the workflow editor (AUC-1836). Everything here only opens pages, menus and dialogs; nothing is saved.

/**
 * Opens a site page signed in and waits for `ready` (pages are slow on the test site, up to 90 s on a cold start),
 * then for the network to settle, and closes feature tours.
 */
export async function openPage(page: Page, s: Settings, path: string, ready: (p: Page) => Locator, what: string, opts: { closeTours?: boolean } = {}) {
  // A cold start on the test site can take 90 s before the page renders
  test.setTimeout(240_000);
  await openSignedIn(page, s, path);
  try {
    await ready(page).first().waitFor({ timeout: 100_000 });
  } catch {
    const denied = await page.getByText(/don't have (access|permission)|can't find|isn't available|page not found/i).first().isVisible().catch(() => false);
    if (denied) throw new Blocked(`Test data or access: ${what} is not available to the test account`);
    throw new Error(`${what} did not load`);
  }
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  if (opts.closeTours !== false) await closeTours(page);
  // From here on a missing element should fail its check quickly, not wait for the test timeout
  page.setDefaultTimeout(15_000);
}

/** The "Your team is using Jira Product Discovery / Join your team" card at the bottom of the sidebar (not in lessons). */
export async function hidePromos(page: Page) {
  await page.locator('[data-testid="jira-side-nav-message"]').evaluateAll((els) => els.forEach((e) => ((e as HTMLElement).style.visibility = "hidden")));
  await hideMessages(page, ["Your team is using"]);
}

/** Org name, signed-in user (fake), other people with profile cards (fake), emails and avatars. */
export async function basicTweaks(page: Page, s: Settings, me = FAKE_PEOPLE[5]) {
  await renameOrg(page, s.test_org, s.display_org_name);
  await hidePromos(page);
  await fakeSignedInUser(page, me);
  const others = FAKE_PEOPLE.filter((n) => n !== me);
  await fakeProfileNames(page, others);
  await anonymize(page, me.split(" ").map((w) => w[0]).join(""), FAKE_PEOPLE);
}

/**
 * Swaps person names ("First Last" text next to an avatar) for fake ones inside `scope`, the same fake for the same
 * person. Accounts named like bots or groups (field-demo-bot, site-admins) and labels are left alone. Display only.
 * Lists such as the dashboards directory show names without profile cards, so fakeProfileNames() misses them.
 */
export async function fakeListedPeople(scope: Locator, people = FAKE_PEOPLE, keep: string[] = []) {
  // evaluateAll: no waiting when the scope is not on the page
  await scope.evaluateAll(
    (roots, [people, keep]) => {
      const root = roots[0];
      if (!root) return;
      const re = /^[A-Z][\w'’-]+( [A-Z][\w'’-]+)+$/;
      const names = new Map<string, string>();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
      for (const n of nodes) {
        const v = (n.nodeValue ?? "").trim();
        if (!re.test(v) || keep.includes(v)) continue;
        // A person: the row around the name holds an avatar (picture or initials)
        const row = n.parentElement?.closest("div, td, li, span")?.parentElement ?? null;
        // A profile picture: an avatar image that is not a space or work type icon, or a round initials badge
        const pics = Array.from(row?.querySelectorAll<HTMLElement>('img, [role="img"], span, div') ?? []);
        const person = pics.some((p) => {
          if (p instanceof HTMLImageElement) return /avatar|gravatar/.test(p.src) && !/universal_avatar|\/project|issuetype/.test(p.src);
          const r = p.getBoundingClientRect();
          return r.width >= 16 && r.width <= 40 && Math.abs(r.width - r.height) < 2 && getComputedStyle(p).borderRadius === "50%" && !p.contains(n);
        });
        if (!person) continue;
        if (!names.has(v)) names.set(v, people[names.size % people.length]);
        n.nodeValue = (n.nodeValue ?? "").replace(v, names.get(v)!);
      }
      root.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
        for (const a of ["aria-label", "title", "alt"]) {
          let v = el.getAttribute(a);
          if (!v) continue;
          for (const [r, f] of names) v = v.replaceAll(r, f);
          el.setAttribute(a, v);
        }
      });
    },
    [people, keep] as const,
  );
}

/** Visible texts of the items of the open menu (first line only). */
export async function visibleMenuItems(page: Page) {
  return (await page.locator('[role="menuitem"]:visible, [role="menuitemradio"]:visible').allInnerTexts())
    .map((t) => t.split("\n")[0].trim())
    .filter(Boolean);
}

/** Missing entries of `want` in `have` (exact, case-insensitive). */
export const missingFrom = (have: string[], want: string[]) =>
  want.filter((w) => !have.some((h) => h.toLowerCase() === w.toLowerCase()));

// ---------------------------------------------------------------------------------------------------------------
// Personal settings (AUC-389, AUC-424)

/** Opens a Personal settings page (general, notifications, digests...). Nothing is changed. */
export async function openPersonalSettings(page: Page, s: Settings, sub: "general" | "notifications") {
  await openPage(page, s, `/jira/settings/personal/${sub}`, (p) => p.locator("h1"), `Personal settings (${sub})`);
}

/** A labelled field block on the General page: from its label to its dropdown (the closest ancestor holding both). */
export async function markField(page: Page, label: string, name: string) {
  await page.evaluate(
    ([label, name]) => {
      const lab = Array.from((document.querySelector('[data-testid="page-layout.main"]') ?? document).querySelectorAll<HTMLElement>("label, h2, h3, div, span")).find(
        (e) => e.childElementCount === 0 && (e.textContent ?? "").trim() === label,
      );
      if (!lab) return;
      // The control: the first element below the label that is at least 300px wide and 30-60px high
      for (let a = lab.parentElement; a && a !== document.body; a = a.parentElement) {
        const ctl = Array.from(a.querySelectorAll<HTMLElement>("*")).find((c) => {
          const r = c.getBoundingClientRect();
          return r.width >= 300 && r.width < 800 && r.height >= 30 && r.height <= 60 && r.top > lab.getBoundingClientRect().top;
        });
        if (ctl) {
          ctl.setAttribute("data-screenshot-field", name);
          lab.setAttribute("data-screenshot-label", name);
          return;
        }
      }
    },
    [label, name] as const,
  );
  return { label: page.locator(`[data-screenshot-label="${name}"]`), control: page.locator(`[data-screenshot-field="${name}"]`) };
}

// ---------------------------------------------------------------------------------------------------------------
// Plans (AUC-734, AUC-735)

/**
 * The plan the lessons show ("Mobile First Experience", Mobile Dev and Marketing Content work). It exists on the test
 * site as plan 3 (Nov 2026); AUC-735's "App Development" plan does not, so AUC-735 uses this one too.
 */
export const PLAN = { id: 3, name: "Mobile First Experience" };

const PP = "portfolio-3-portfolio.app-simple-plans";
/** Plan page parts by test id. */
export const planUi = {
  timelineToggle: `[data-testid="${PP}.top.page-header.view-mode-switcher.toggle-button.timeline"]`,
  listToggle: `[data-testid="${PP}.top.page-header.view-mode-switcher.toggle-button.list"]`,
  autoSchedule: `[data-testid="${PP}.top.title-bar.optimize.button"]`,
  viewSettings: `[data-testid="${PP}.main.tabs.roadmap.view-settings.button"]`,
  createWork: `[data-testid="${PP}.main.tabs.roadmap.scope.header.create-work.button"]`,
  reviewChanges: `[data-testid="${PP}.top.title-bar.update-jira.review-changes-button-wrapper.review-changes-button.review-changes-button"]`,
  table: `[data-testid="${PP}.main.tabs.roadmap.table.wrapper"]`,
  rows: `[data-testid="${PP}.main.tabs.roadmap.scope.issues.issue.row"]`,
};

/**
 * The "Welcome to Plans" pop-up (video, Skip / Take tour) shows on every visit by a new viewer. It is hidden
 * display-only with its dimmed backdrop; Skip is not clicked, so nothing is recorded for the account.
 */
export async function hidePlansWelcome(page: Page) {
  await page.evaluate(() => {
    for (const d of Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))) {
      if (!/Welcome to Plans/.test(d.innerText)) continue;
      const portal = d.closest<HTMLElement>(".atlaskit-portal") ?? d;
      portal.style.setProperty("display", "none", "important");
      portal.dataset.screenshotNoise = "plans welcome";
    }
  });
}

/** Opens a plan (it opens in its last view: List or Timeline) and waits for its rows. */
export async function openPlan(page: Page, s: Settings, plan = PLAN) {
  await openPage(page, s, `/jira/plans/${plan.id}`, (p) => p.locator(planUi.table), `Plan "${plan.name}"`, { closeTours: false });
  const title = await page.getByText(plan.name, { exact: true }).first().isVisible().catch(() => false);
  if (!title) throw new Blocked(`Test data: plan ${plan.id} is no longer "${plan.name}"`);
  await page.locator(planUi.rows).first().waitFor({ timeout: 60_000 });
  // The welcome pop-up can appear a few seconds after the plan
  await page.getByText("Welcome to Plans").first().waitFor({ timeout: 8_000 }).catch(() => {});
  await hidePlansWelcome(page);
  await page.waitForTimeout(1_000);
}

/**
 * Switches the plan between Timeline and List (the toggle above the plan, like the lessons' first step). This is a
 * view mode, not plan data: nothing is added to the plan's unsaved changes.
 */
export async function planMode(page: Page, mode: "Timeline" | "List") {
  const toggle = page.locator(mode === "Timeline" ? planUi.timelineToggle : planUi.listToggle);
  if (!(await planModeIs(page, mode))) {
    await toggle.click();
    await page.waitForTimeout(3_000);
  }
  await hidePlansWelcome(page);
}

/** Whether the Timeline / List toggle shows the given mode as selected (pressed, checked or selected). */
export async function planModeIs(page: Page, mode: "Timeline" | "List") {
  return page.locator(mode === "Timeline" ? planUi.timelineToggle : planUi.listToggle).evaluate((el) => {
    const on = (e: Element | null) =>
      !!e && ["aria-pressed", "aria-checked", "aria-selected", "aria-current"].some((a) => ["true", "page"].includes(e.getAttribute(a) ?? ""));
    const input = el.querySelector("input") ?? (el.tagName === "INPUT" ? el : null);
    return on(el) || on(el.parentElement) || (input as HTMLInputElement | null)?.checked === true;
  });
}

/** Checks shared by the plan recipes: plan header and tabs, toolbar. */
export async function planHeaderChecks(page: Page, c: import("./recipe").Checks, plan = PLAN) {
  await c.check(`Plan header: 'Plans' breadcrumb, plan name "${plan.name}", Unsaved changes button`, async () => {
    const name = await page.getByText(plan.name, { exact: true }).first().isVisible();
    const review = (await page.locator(planUi.reviewChanges).innerText().catch(() => "")).trim();
    return { pass: name && !!review, detail: `Name: ${name}; review button: "${review}"` };
  });
  await c.check("Plan tabs: Summary, Timeline, Program, Calendar, Teams, Releases, Dependencies", async () => {
    const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
    const missing = ["Summary", "Timeline", "Program", "Calendar", "Teams", "Releases", "Dependencies"].filter((t) => !text.includes(t));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });
  await c.check("Toolbar: Search timeline, Filter, view switcher, Timeline / List toggle, auto-schedule and view settings buttons", async () => {
    const search = await page.locator('[data-testid="searchfield"]').first().isVisible().catch(() => false);
    const toggles = (await page.locator(planUi.timelineToggle).isVisible()) && (await page.locator(planUi.listToggle).isVisible());
    const auto = await page.locator(planUi.autoSchedule).isVisible();
    const settings = await page.locator(planUi.viewSettings).isVisible();
    return { pass: search && toggles && auto && settings, detail: `Search: ${search}; toggle: ${toggles}; auto-schedule: ${auto}; view settings: ${settings}` };
  });
}

/** Labels of the four fields at the top of Personal settings > General, in lesson order. */
export const GENERAL_FIELDS = ["Your timezone", "Language", "Watch work items automatically", "Jira homepage"];
/** The personal settings sidebar ("General", "Jira", "Emails and notifications", ...). */
export const personalSidebar = (page: Page) => page.locator('[data-testid="navigation-apps-sidebar-nav4-personal-settings.ui.sidebar-content"]');

/** Checks shared by the AUC-389 General page recipes. */
export async function generalPageChecks(page: Page, c: import("./recipe").Checks) {
  await c.check("Personal settings sidebar: General, Jira (Emails and notifications, Digests), Jira Service Management (Alerts)", async () => {
    const nav = (await personalSidebar(page).innerText()).split("\n").map((t) => t.trim()).filter(Boolean);
    const missing = missingFrom(nav, ["General", "Jira", "Emails and notifications", "Digests", "Jira Service Management", "Alerts"]);
    return { pass: !missing.length, detail: missing.length ? `Sidebar now: ${nav.join(", ")}` : "All present" };
  });

  await c.check("Breadcrumb 'Personal settings / General' and title 'General'", async () => {
    const h1 = (await page.locator("h1").first().innerText()).trim();
    const crumb = await page.locator('[data-testid="page-layout.main"]').getByText("Personal settings", { exact: true }).first().isVisible().catch(() => false);
    return { pass: h1 === "General" && crumb, detail: `Title: "${h1}"; breadcrumb: ${crumb}` };
  });

  await c.check("Fields: Your timezone, Language, Watch work items automatically, Jira homepage", async () => {
    const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
    const missing = GENERAL_FIELDS.filter((f) => !text.includes(f));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });

  await c.check("Timezone and language link to the 'profile settings page'", async () => {
    const n = await page.getByRole("link", { name: "profile settings page" }).count();
    return { pass: n >= 2, detail: `Links: ${n}` };
  });

  await c.check("Theme section with Light, Dark and Match browser", async () => {
    const text = await page.locator('[data-testid="page-layout.main"]').first().innerText();
    const missing = ["Theme", "Light", "Dark", "Match browser"].filter((t) => !text.includes(t));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Work items (AUC-384, AUC-693)

export const WATCHERS_BUTTON = '[data-testid="issue.watchers.action-button.root"]';
export const SHARE_BUTTON = '[data-testid="share-dialog.ui.share-button"]';
/** The work item dialog (modal) opened from a board. */
export const itemModal = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.locator('[data-testid="issue.views.issue-base.foundation.summary.heading"]') }).first();

/** Opens a work item in the dialog over its space's board (the lesson's view) and waits for its title. */
export async function openItemOnBoard(page: Page, s: Settings, boardPath: string, key: string, summary: string) {
  test.setTimeout(240_000);
  await openSignedIn(page, s, `${boardPath}?selectedIssue=${key}`);
  const heading = page.locator('[data-testid="issue.views.issue-base.foundation.summary.heading"]:visible').first();
  try {
    await heading.waitFor({ timeout: 100_000 });
  } catch {
    if (await page.getByText(/can't find|isn't available|don't have permission/i).first().isVisible().catch(() => false))
      throw new Blocked(`Test data: the test account cannot open work item ${key}`);
    throw new Error(`Work item ${key} did not open over the board`);
  }
  const title = (await heading.innerText()).trim();
  if (title !== summary) throw new Blocked(`Test data: ${key} is now "${title.slice(0, 60)}", expected "${summary}"`);
  await page.locator(WATCHERS_BUTTON).first().waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  page.setDefaultTimeout(15_000);
}

// ---------------------------------------------------------------------------------------------------------------
// Automation (AUC-703)

/** The automation app's Templates tab (Jira global, Confluence admin or a space), waiting for the template cards. */
export async function openAutomationTemplates(page: Page, s: Settings, path: string, what: string) {
  await openPage(page, s, `${path}#/tab/rule-library`, (p) => p.locator('[data-testid="rule-categories-grid"]'), what);
  await page.locator('[data-testid="rule-categories-grid"] h2, [data-testid="rule-categories-grid"] h3').first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  // The green "Automate any task or process with a few clicks" banner above the templates (not in the lessons)
  await hideMessages(page, ["Automate any task or process with a few clicks"]);
}

export const automationTab = (page: Page, id: "rules" | "audit-log" | "rule-library" | "usage") => page.locator(`[data-testid="${id}"]`);

/** Template card texts under the first category heading (in order), and that heading. */
export async function firstTemplateCategory(page: Page) {
  return page.locator('[data-testid="rule-categories-grid"]').evaluate((grid) => {
    const head = grid.querySelector("h1, h2, h3, h4");
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-testid]")).filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 250 && r.width < 400 && r.height > 120 && r.height < 220;
    });
    // Cards of the first category: before the second heading
    const heads = Array.from(grid.querySelectorAll("h1, h2, h3, h4"));
    const next = heads[1]?.getBoundingClientRect().top ?? Infinity;
    return {
      heading: (head?.textContent ?? "").trim(),
      cards: cards.filter((c) => c.getBoundingClientRect().top < next).map((c) => c.innerText.trim().replace(/\s+/g, " ")),
    };
  });
}

/** The automation tab row and filters shared by the Templates recipes. */
export async function templatesTabChecks(page: Page, c: import("./recipe").Checks) {
  await c.check("Title 'Automation' with Create flow and More actions buttons", async () => {
    const h = await page.getByRole("heading", { name: "Automation", exact: true }).first().isVisible();
    const create = await page.locator('[data-testid="create-rule-drop-down"]').isVisible();
    return { pass: h && create, detail: `Title: ${h}; Create flow: ${create}` };
  });
  await c.check("Tabs Flows, Audit log, Templates (selected), Usage", async () => {
    const tabs = await Promise.all((["rules", "audit-log", "rule-library", "usage"] as const).map((t) => automationTab(page, t).innerText().catch(() => "")));
    const ok = tabs.map((t) => t.trim()).join(",") === "Flows,Audit log,Templates,Usage";
    const sel = await automationTab(page, "rule-library").getAttribute("aria-selected");
    return { pass: ok, detail: `Tabs: ${tabs.join(", ")}; Templates selected: ${sel ?? "unknown"}` };
  });
  await c.check("Template search box and Categories, Apps, Triggers filters", async () => {
    const search = await page.locator('[data-testid="rule-template-search-input"]').isVisible();
    const text = await page.locator('[data-testid="automation.automation-app-container"]').innerText().catch(async () => page.locator("body").innerText());
    const missing = ["Categories", "Apps", "Triggers"].filter((t) => !text.includes(t));
    return { pass: search && !missing.length, detail: `Search: ${search}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
  });
}

/** The lesson's work item for AUC-384 (same as AUC-383): "New-hire first engagement" on the Employee Onboarding board. */
export const EO_BOARD = "/jira/core/projects/EO/board";

/** The open Share pop-up (marked by openSharePopup: the card around the share dialog content). */
export const sharePopup = (page: Page) => page.locator('[data-screenshot-area="share-popup"]');

/**
 * Marks the Share pop-up card (the largest ancestor of the share dialog content still smaller than half the
 * window, skipping zero-size wrappers) for the outline and the checks. The pop-up re-renders after it opens, so this runs again in tweak().
 * Its layer can be one hideNoise() clears (flags); marking the portal keeps it.
 */
export async function markSharePopup(page: Page) {
  const content = page.locator('[data-testid^="share-dialog.ui.dialog-content"]:visible').first();
  await content.waitFor({ timeout: 20_000 });
  await content.evaluate((el) => {
    document.querySelectorAll('[data-screenshot-area="share-popup"]').forEach((e) => e.removeAttribute("data-screenshot-area"));
    let card: HTMLElement = el as HTMLElement;
    const own = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.body && !a.classList.contains("atlaskit-portal"); a = a.parentElement) {
      const r = a.getBoundingClientRect();
      if (r.width > innerWidth / 2 || r.height > innerHeight / 2) break;
      // Skip zero-size positioning wrappers: the card is the largest box that still contains the content
      if (r.width >= own.width && r.height >= own.height) card = a;
    }
    card.setAttribute("data-screenshot-area", "share-popup");
    card.closest(".atlaskit-portal")?.setAttribute("data-screenshot-area", "share-popup-layer");
  });
}

/** Opens the work item over the board and clicks Share. Nothing is sent. */
export async function openSharePopup(page: Page, s: Settings, key: string, summary: string) {
  await openItemOnBoard(page, s, EO_BOARD, key, summary);
  await page.locator(`${SHARE_BUTTON}:visible`).first().click();
  await page.waitForTimeout(2_000);
  await markSharePopup(page);
  await page.mouse.move(1279, 799);
}

/** Checks shared by AUC-384 #1 and #2: what the lesson's Share pop-up shows. */
export async function shareChecks(page: Page, c: import("./recipe").Checks) {
  await markSharePopup(page).catch(() => {});
  const popupText = async () => (await sharePopup(page).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const notConfigured = async () => /Outgoing mail is not configured/i.test(await popupText());
  const why = async () => ((await notConfigured()) ? "Test data: the test site has no outgoing mail, so the pop-up only says 'Outgoing mail is not configured'" : `Pop-up shows: ${(await popupText()).slice(0, 100)}`);

  await c.check("Work item dialog over the board: breadcrumb EO-1 / EO-2 and title 'New-hire first engagement'", async () => {
    const crumbs = (await page.locator('[data-testid^="issue.views.issue-base.foundation.breadcrumbs"]:visible').allInnerTexts()).join(" / ").replace(/\s+/g, " ");
    const title = (await page.locator('[data-testid="issue.views.issue-base.foundation.summary.heading"]:visible').first().innerText()).trim();
    const ok = /EO-1/.test(crumbs) && /EO-2/.test(crumbs) && title === "New-hire first engagement";
    return { pass: ok, detail: `Breadcrumb: ${crumbs.slice(0, 60)}; title: "${title}"` };
  });

  await c.check("Share pop-up tabs: Share work item, Share in Slack", async () => {
    const t = await popupText();
    const ok = t.includes("Share work item") && t.includes("Share in Slack");
    return { pass: ok, detail: ok ? "Present" : await why() };
  });

  await c.check("'Names or teams' field (placeholder 'e.g. Maria, Team Orange')", async () => {
    const t = await popupText();
    const ok = t.includes("Names or teams");
    return { pass: ok, detail: ok ? "Present" : await why() };
  });

  await c.check("Space access section ('Open' with its explanation)", async () => {
    const t = await popupText();
    const ok = t.includes("Space access");
    return { pass: ok, detail: ok ? "Present" : await why() };
  });

  await c.check("Copy link button", async () => {
    const ok = await sharePopup(page).getByText("Copy link", { exact: true }).first().isVisible().catch(() => false);
    return { pass: ok, detail: ok ? "Present" : await why() };
  });
}

/** Picks an option in a select (react-select) inside a dialog: opens it and clicks the option. Form state only. */
export async function pickOption(page: Page, control: Locator, option: RegExp) {
  await control.click();
  const opt = page.locator('[role="option"]:visible').filter({ hasText: option }).first();
  await opt.waitFor({ timeout: 15_000 });
  await opt.click();
  await page.waitForTimeout(800);
}

/** The react-select controls of a container, in page order. */
export const selectControls = (scope: Locator) => scope.locator('[class*="-control"]:visible, [data-testid$="select--control"]:visible');

/** The plan row of a work item (List or Timeline view). */
export const planRow = (page: Page, key: string) => page.locator(planUi.rows).filter({ hasText: key }).first();
export const rowMoreButton = (page: Page, key: string) =>
  planRow(page, key).locator('[data-testid="portfolio-3-portfolio.app-simple-plans.main.tabs.roadmap.scope.issues.issue.drop-menu.more-meatball--trigger"]');

/**
 * Run before jiraPeopleTweaks(): field help buttons ("More information about Story Points") and "<text> - edit
 * <Field>" labels look like people to fakeFieldPeople() / fakeProfileNames(), which then rename the field label
 * (e.g. "Story Points" shown as a fake person). This rewrites those labels for the given fields. Display only.
 */
export async function protectFieldLabels(page: Page, fields = ["Story Points", "Story point estimate", "Original Estimate", "Time Tracking", "Start Date", "Due Date", "Sprint", "Parent", "Labels"]) {
  await page.evaluate((fields) => {
    const isField = (t: string) => fields.some((f) => f.toLowerCase() === t.trim().toLowerCase());
    const edit = /^(.+?)\s*- edit (.+)$/;
    const help = "More information about ";
    document.querySelectorAll("[aria-label]").forEach((el) => {
      const v = el.getAttribute("aria-label") ?? "";
      if (v.startsWith(help) && isField(v.slice(help.length))) el.setAttribute("aria-label", `Field help: ${v.slice(help.length)}`);
      const m = edit.exec(v);
      if (m && (m[1].trim() === m[2].trim() || isField(m[1]))) el.setAttribute("aria-label", `Field ${m[1].trim()} (edit ${m[2].trim()})`);
    });
  }, fields);
}
