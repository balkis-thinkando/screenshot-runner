import { Locator, Page } from "@playwright/test";
import { Checks } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { closeTours, jiraPeopleTweaks } from "./b2-jira";
import { FAKE_PEOPLE } from "./tweaks";

// Helpers for the batch 3 Jira board recipes (AUC-1131, AUC-1134, AUC-1136, AUC-1137, AUC-1690, AUC-1691, AUC-1695).
// Boards on the test site used as stand-ins for the lesson boards (checked Nov 2026 through the agile REST API):
//  - kanban: MP board (Mobile Program), the board the AUC-1131 and AUC-1695 lessons show. Kanban backlog off,
//    grouped by Query (Expedite / Everything Else swimlanes).
//  - scrum with an active sprint: TH board (M0004 - Team Horizon), 3 columns and 5 sprint items. PLAT board (the
//    AUC-1134 lesson board) has no active sprint, only a future one.
//  - scrum with a backlog: CC Web Development (M0002 - CodeCrafters): active sprint and 10 backlog items (TH has none).
//  - space with several boards: Mobile Dev (MOBL Cowboys and MOBL Baltimore).
// Board settings (columns, swimlanes, card colors, custom filters) save as soon as they change, so recipes only open
// pages, menus and dialogs, and type into dialogs without submitting them.

export type Board = { key: string; id: number; name: string; space: string };

export const KANBAN: Board = { key: "MP", id: 5, name: "MP board", space: "Mobile Program" };
export const SCRUM: Board = { key: "TH", id: 182, name: "TH board", space: "M0004 - Team Horizon" };
export const SCRUM_BACKLOG: Board = { key: "M0002", id: 146, name: "CC Web Development", space: "M0002 - CodeCrafters" };
export const MULTI: Board = { key: "MOBL", id: 2, name: "MOBL Cowboys", space: "Mobile Dev" };
export const PLAT: Board = { key: "PLAT", id: 1, name: "PLAT board", space: "Platform Development" };

export const boardPath = (b: Board, rest = "") => `/jira/software/c/projects/${b.key}/boards/${b.id}${rest}`;

export const columns = (page: Page) => page.locator('[data-testid="platform-board-kit.ui.column.draggable-column.styled-wrapper"]');
export const boardArea = (page: Page) => page.locator('[data-testid="software-board.board-area"]');
export const swimlanes = (page: Page) => page.locator('[data-testid="platform-board-kit.ui.swimlane.swimlane-wrapper"]');
export const groupButton = (page: Page) => page.locator('[data-testid="software-board.header.controls-bar.swimlane-switch"]');
export const filtersButton = (page: Page) => page.locator('[data-testid="filters.common.ui.list.custom-filters-filter"]');
export const searchBoard = (page: Page) => page.locator('[data-testid="software-filters.ui.stateless.search-field"]');
export const sprintDetailsButton = (page: Page) =>
  page.locator('[data-testid="software-board.header.sprint-controls.sprint-details.trigger-button.icon-button"]');
export const completeSprint = (page: Page) => page.locator('[data-testid="software-board.header.complete-sprint-button"]');

/** A tab of the space's horizontal navigation (Summary, Backlog, Active sprints, Kanban board...). */
export const tab = (page: Page, name: string) =>
  page.locator('[data-testid^="navigation-kit-ui-tab.ui.link-tab"]').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first();
/** The selected tab's label. */
export async function selectedTab(page: Page) {
  const t = page.locator('[data-testid="navigation-kit-ui-tab.ui.link-tab.non-interactive-tab"], [data-testid^="navigation-kit-ui-tab.ui"][aria-current="page"]');
  return (await t.first().innerText().catch(() => "")).trim();
}
/** Labels of the visible space tabs. */
export async function tabLabels(page: Page) {
  return (await page.locator('[data-testid^="navigation-kit-ui-tab.ui.link-tab"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

export const sidebarBoard = (page: Page, b: Board) => page.locator(`[data-testid="NAV4_boar_${b.id}-container"]`);
export const sidebarSpace = (page: Page, b: Board) => page.locator(`[data-testid="NAV4_proj_${b.key}-container"]`);
/** The expanded space's board list in the sidebar (under the space row). */
export const sidebarBoards = (page: Page) =>
  page.locator('[data-testid="navigation-apps-sidebar-nav4-sidebars-content-projects-jsw-project-menu.ui.jsw-expandable-project.async-content.jsw-boards.recent-section"]');
/** Recent spaces in the sidebar: they change with the account's history, so masked in comparisons. */
export const recentSpaces = (page: Page) =>
  page.locator('[data-testid="navigation-apps-sidebar-nav4-sidebars-content-projects-core.common.ui.content.recent-section.recent-section"]');

/** Unique column names (upper case on scrum and kanban boards; swimlanes repeat them). */
export async function columnNames(page: Page) {
  const names = await page
    .locator('[data-testid="platform-board-kit.common.ui.column-header.editable-title.column-title.column-name"]')
    .allInnerTexts();
  const fromWrappers = names.length ? names : (await columns(page).allInnerTexts()).map((t) => t.split("\n")[0]);
  return Array.from(new Set(fromWrappers.map((t) => t.trim().toUpperCase()).filter(Boolean)));
}

/** Opens a board view (board, backlog) and waits for its columns or backlog lists. */
export async function openBoard(page: Page, s: Settings, b: Board, rest = "") {
  await openSignedIn(page, s, boardPath(b, rest));
  const ready = rest.includes("backlog")
    ? page.locator('[data-testid^="software-backlog.card-list.container."]').first()
    : columns(page).first();
  await ready.waitFor({ timeout: 90_000 });
  await page.getByRole("heading", { name: b.name }).or(page.getByText(b.name, { exact: true })).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeTours(page);
}

/** Hides the "Your team is using Jira Product Discovery" ad at the bottom of the sidebar (display only). */
export async function hideSidebarAd(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>('[data-testid="side-nav-recommendation.jira-side-nav"], [data-testid="jira-side-nav-message"]')
      .forEach((el) => (el.style.display = "none"));
  });
}

/**
 * Board cards and the people filter show avatars with no name next to them, so anonymize() would give them all the
 * signed-in user's initials. Replaces each profile picture with initials of a fake person instead: the same picture
 * (same person) gets the same fake, and the signed-in user's own picture gets `me` (display only).
 */
export async function fakeBoardAvatars(page: Page, me = FAKE_PEOPLE[5]) {
  const others = FAKE_PEOPLE.filter((n) => n !== me);
  await page.evaluate(
    async ([me, others]) => {
      const mine = await fetch("/gateway/api/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      // Avatar URLs differ by size suffix: compare the path up to the last "/"
      const stem = (u: string) => u.replace(/[?#].*$/, "").replace(/\/[^/]*$/, "");
      const myStem = mine?.picture ? stem(String(mine.picture)) : null;
      const myId: string | null = mine?.account_id ?? null;
      const icon = /\/view\/type\/(issuetype|project|SD_REQTYPE)|issuetype/i;
      const colours = ["#0C66E4", "#E56910", "#6E5DC6", "#1F845A", "#C9372C", "#206A83"];
      const seen = new Map<string, number>();
      const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      document.querySelectorAll<HTMLImageElement>('img[src*="avatar"]').forEach((img) => {
        const src = img.getAttribute("src") ?? "";
        if (icon.test(src) || img.closest("[data-screenshot-keep]")) return;
        const { width, height } = img.getBoundingClientRect();
        const isMe = (myStem && stem(src) === myStem) || (myId && src.includes(myId));
        let who = me;
        let colour = "#1D2125";
        if (!isMe) {
          const k = stem(src);
          if (!seen.has(k)) seen.set(k, seen.size);
          const i = seen.get(k)!;
          who = others[i % others.length];
          colour = colours[i % colours.length];
        }
        const span = document.createElement("span");
        span.setAttribute("data-screenshot-tweak", "avatar");
        span.textContent = initials(who);
        span.style.cssText =
          `display:inline-flex;align-items:center;justify-content:center;width:${width || 24}px;height:${height || 24}px;` +
          `border-radius:50%;background:${colour};color:#fff;font:600 ${Math.min(10, Math.round((height || 24) * 0.45))}px sans-serif;` +
          "white-space:nowrap;overflow:hidden";
        img.replaceWith(span);
      });
    },
    [me, others] as const,
  );
}

/** The usual board tweaks: sidebar ad hidden, avatars, org name, signed-in user, people. */
export async function boardTweaks(page: Page, s: Settings) {
  await hideSidebarAd(page);
  await fakeBoardAvatars(page);
  await jiraPeopleTweaks(page, s);
}

/** Opens the board's Custom filters (formerly Quick filters) menu. */
export async function openFiltersMenu(page: Page) {
  await filtersButton(page).click();
  await page.locator('[data-testid="filters.common.ui.list.menu-list-wrapper"]').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
}
export const filtersMenu = (page: Page) =>
  page.locator('[data-testid="filters.common.ui.list.menu-list-wrapper"]').locator("xpath=..");

/** Text of a locator, with lines holding an "@" dropped (never report an email). */
export const safeText = async (l: Locator) =>
  (await l.innerText().catch(() => "")).split("\n").filter((t) => !t.includes("@")).join("\n");

/** Checks shared by the board recipes: header, tabs and the filter bar. */
export async function boardHeaderChecks(page: Page, c: Checks, b: Board, lessonTab: string, kanban: boolean) {
  await c.check(`Breadcrumb 'Spaces / ${b.space}' and board title '${b.name}'`, async () => {
    const main = await page.locator('[data-testid="horizontal-nav.ui.content.horizontal-nav"]').innerText().catch(() => "");
    const ok = main.includes("Spaces") && main.includes(b.space) && main.includes(b.name);
    return { pass: ok, detail: ok ? "Present" : `Header shows: ${main.split("\n").slice(0, 3).join(" / ").slice(0, 120)}` };
  });

  await c.check(`'${lessonTab}' tab selected`, async () => {
    const sel = await selectedTab(page);
    return { pass: sel === lessonTab, detail: `Selected tab: "${sel}"` };
  });

  await c.check("Filter bar: Search board, people, Quick filters, Group", async () => {
    const search = await searchBoard(page).isVisible().catch(() => false);
    const people = await page.locator('[data-testid="filters.ui.filters.assignee.stateless.assignee-filter"]').isVisible().catch(() => false);
    const quick = await page.getByRole("button", { name: /^Quick filters/ }).first().isVisible().catch(() => false);
    const custom = await filtersButton(page).isVisible().catch(() => false);
    const group = await groupButton(page).isVisible().catch(() => false);
    return {
      pass: search && people && quick && group,
      detail: `Search: ${search}; people: ${people}; group: ${group}; ` +
        (quick ? "Quick filters present" : custom ? "UI change: 'Quick filters' is now 'Custom filters'" : "no Quick/Custom filters button"),
    };
  });

  if (!kanban) {
    await c.check("Complete sprint button", async () => {
      const v = await completeSprint(page).isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing (test data: no active sprint?)" };
    });
  }
}
