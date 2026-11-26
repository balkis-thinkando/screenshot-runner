import { Locator, Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";
import { FAKE_PEOPLE } from "./tweaks";

// Shared steps for the batch 3 Confluence recipes (AUC-403, AUC-410, AUC-413, AUC-1402, AUC-1424, AUC-1744):
// space settings, page actions, personal settings. Everything here only opens pages, menus and dialogs: nothing
// is saved, created, published or changed. The lessons use a "Marketing" space; the recipes use the SyncUp
// course space, where the test account is a space admin.

/** The space used for space settings and space home shots. */
export const SPACE = { key: "SyncUp", name: "M0080 - SyncUp" };

/** The page used for page actions (Share, More actions, editor): the SyncUp "Engineering onboarding guide". */
export const PAGE = { space: "SyncUp", id: "2130015", title: "Engineering onboarding guide" };

/**
 * Opens a Confluence URL through Atlassian sign-in and waits for `ready`. Some pages (space settings) are
 * streamed slowly by the server and can sit on an empty document for a while, so the wait is long.
 */
export async function openWikiPath(page: Page, s: Settings, path: string, ready: Locator, what: string) {
  const url = `${s.test_site}/wiki${path}`;
  await page.goto(`https://id.atlassian.com/login?continue=${encodeURIComponent(url)}`, { waitUntil: "commit" });
  await ready.waitFor({ timeout: 90_000 }).catch(() => {});
  if (new URL(page.url()).hostname === "id.atlassian.com") throw new Blocked("Session expired: redirected to sign-in");
  if (!(await ready.isVisible())) {
    const denied = await page.getByText(/don't have (permission|access)|not authorized/i).first().isVisible().catch(() => false);
    if (denied) throw new Blocked(`The test account cannot open ${what}`);
    throw new Error(`${what} did not load`);
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/** Main content heading (h1/h2) with this exact text. */
export const heading = (page: Page, text: string | RegExp) =>
  page.locator("#AkMainContent").locator("h1, h2").filter({ hasText: typeof text === "string" ? new RegExp(`^\\s*${text}\\s*$`) : text }).first();

/** A space settings page of SPACE, e.g. "details", "members", "look-and-feel/templates". */
export async function openSpaceSettings(page: Page, s: Settings, sub: string, title: string) {
  await openWikiPath(page, s, `/spaces/${SPACE.key}/settings/${sub}`, heading(page, title), `space settings "${title}"`);
}

/** The space settings sidebar. */
export const settingsNav = (page: Page) => page.locator("#side-navigation");

/** Expands a group of the space settings sidebar ("Look and feel", "Space access") if it is collapsed (display state only). */
export async function expandNavGroup(page: Page, name: string) {
  const b = settingsNav(page).getByRole("button", { name, exact: true }).first();
  if ((await b.getAttribute("aria-expanded").catch(() => null)) === "false") {
    await b.click();
    await page.waitForTimeout(800);
  }
}

/** A link of the space settings sidebar by its text. */
export const navLink = (page: Page, name: string) => settingsNav(page).getByRole("link", { name, exact: true }).first();

/** The space home (overview) of SPACE. */
export async function openSpaceHome(page: Page, s: Settings) {
  await openWikiPath(page, s, `/spaces/${SPACE.key}/overview`, page.locator('[data-testid="title-text"], h1').first(), "the space home");
}

/** A page of the test site, ready once its title shows. */
export async function openPage(page: Page, s: Settings, p = PAGE) {
  await openWikiPath(page, s, `/spaces/${p.space}/pages/${p.id}`, page.locator('[data-testid="title-text"]').first(), `page ${p.id}`);
}

/** Closes pop-ups that opened on their own (feature tours); hiding them can leave the page dimmed. */
export async function closePopups(page: Page) {
  const popup = page.locator('[role="dialog"]');
  if (await popup.first().isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await popup.first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

/**
 * Replaces the names on links to people's profiles (/wiki/people/..., "Created by", bylines, recent updates) with
 * fake names, the same fake name for the same person. Run before anonymize() so avatars next to a name get its
 * initials.
 */
export async function fakePeopleLinks(page: Page, people = FAKE_PEOPLE) {
  await page.evaluate((people) => {
    const map = new Map<string, string>();
    const fake = (real: string) => {
      if (!map.has(real)) map.set(real, people[map.size % people.length]);
      return map.get(real)!;
    };
    const links = Array.from(document.querySelectorAll<HTMLElement>('a[href*="/people/"], a[href*="/wiki/display/~"], [data-testid="user-profile-card-trigger-wrapper"]'));
    for (const a of links) {
      const real = (a.innerText || "").replace(/\(Unlicensed\)|\(Deactivated\)/g, "").trim();
      // Skip empty or long texts, and names that are already fake (e.g. the signed-in user after fakeSignedInUser)
      if (!real || real.length > 60 || people.includes(real)) continue;
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      let first = true;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.nodeValue?.trim()) continue;
        n.nodeValue = first ? fake(real) : "";
        first = false;
      }
    }
    // The same names elsewhere on the page (labels, plain text)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let v = n.nodeValue ?? "";
      for (const [real, f] of map) if (v.includes(real)) v = v.replaceAll(real, f);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const at of ["aria-label", "title", "alt"]) {
        let v = el.getAttribute(at);
        if (!v) continue;
        for (const [real, f] of map) v = v.replaceAll(real, f);
        el.setAttribute(at, v);
      }
    });
  }, people);
}

/** Lesson-style orange outline (no dimming) around a box, as the lessons with a light outline show. */
export async function outline(page: Page, loc: Locator | Locator[]) {
  const boxes = [];
  for (const l of Array.isArray(loc) ? loc : [loc]) {
    const b = await l.boundingBox();
    if (b) boxes.push(b);
  }
  if (!boxes.length) throw new Error("outline: nothing visible to outline");
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const box = { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
  await page.evaluate((b) => {
    const pad = 4;
    const d = document.createElement("div");
    d.setAttribute("data-screenshot-tweak", "outline");
    d.style.cssText =
      `position:fixed;pointer-events:none;z-index:2147483647;left:${b.x - pad}px;top:${b.y - pad}px;` +
      `width:${b.width + pad * 2}px;height:${b.height + pad * 2}px;border:3px solid #FCA700;border-radius:12px;box-sizing:border-box`;
    document.body.appendChild(d);
  }, box);
}

/** Visible texts of a menu's items, trimmed, one line each. */
export async function itemTexts(loc: Locator) {
  return (await loc.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Check helper: which of `want` are missing from `have` (prefix match). */
export function missingFrom(have: string[], want: string[]) {
  return want.filter((w) => !have.some((h) => h === w || h.startsWith(w)));
}

// ---------- Space settings > Users ----------

/** The people, groups and apps list of Space settings > Users. */
export const usersTable = (page: Page) => page.locator("#AkMainContent table").first();

/** Hides the "Your site now uses roles" banner and the "Add new people" tour of the Users page (display-only). */
export async function hideRolesBanner(page: Page) {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("#AkMainContent *, .atlaskit-portal *"))) {
      const t = (el.innerText || "").trim();
      if (!/^(Your site now uses roles|Add new people\b)/.test(t) || t.length > 600) continue;
      let box: HTMLElement = el;
      // The banner or tour card: the largest ancestor that is still small
      while (box.parentElement && box.parentElement.getBoundingClientRect().height < 260 && !box.parentElement.querySelector("table")) box = box.parentElement;
      box.style.display = "none";
    }
  });
  await page.waitForTimeout(500);
}

// ---------- Outlines ----------

/**
 * Like spotlightAreas() (lib/tweaks.ts): dims the page except each area and outlines each one in orange. The dim is
 * painted on a canvas (holes cut with clearRect-style compositing) and the outlines are plain boxes, because the
 * SVG dimming of spotlightAreas() did not show on some Confluence settings pages.
 */
export async function dimAreas(page: Page, areas: (Locator | Locator[])[]) {
  const rects = [];
  for (const area of areas) {
    const parts = [];
    for (const l of Array.isArray(area) ? area : [area]) {
      const r = await l.boundingBox();
      if (!r) throw new Error("dimAreas: an area is not visible");
      parts.push(r);
    }
    const x = Math.min(...parts.map((r) => r.x));
    const y = Math.min(...parts.map((r) => r.y));
    rects.push({ x, y, width: Math.max(...parts.map((r) => r.x + r.width)) - x, height: Math.max(...parts.map((r) => r.y + r.height)) - y });
  }
  await page.evaluate((rects) => {
    const pad = 4;
    const rad = 12;
    const boxes = rects.map((r) => ({ x: r.x - pad, y: r.y - pad, w: r.width + pad * 2, h: r.height + pad * 2 }));
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-screenshot-tweak", "spotlight");
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646";
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000"; // opaque, so the holes are cut out completely
    for (const b of boxes) {
      const r = Math.min(rad, b.w / 2, b.h / 2);
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y);
      ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
      ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
      ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
      ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
      ctx.closePath();
      ctx.fill();
    }
    document.body.appendChild(canvas);
    for (const b of boxes) {
      const d = document.createElement("div");
      d.setAttribute("data-screenshot-tweak", "spotlight");
      d.style.cssText =
        `position:fixed;pointer-events:none;z-index:2147483647;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;` +
        `border:3px solid #FCA700;border-radius:${rad}px;box-sizing:border-box`;
      document.body.appendChild(d);
    }
  }, rects);
}

// ---------- Space settings > Look and feel > Templates ----------

/** The Blueprint templates list (the second table of the Templates page). */
export const blueprintTable = (page: Page) => page.locator("#AkMainContent table").nth(1);
/** The bold row of a blueprint (toggle and Promote button). */
export const blueprintRow = (page: Page, name: string) =>
  blueprintTable(page).locator("tr").filter({ has: page.locator("b", { hasText: new RegExp(`^\\s*${name}\\s*$`) }) }).first();
/** The enable / disable toggle of a blueprint (a checkbox inside a label). */
export const blueprintToggle = (page: Page, name: string) => blueprintRow(page, name).locator('input[type="checkbox"]').first();

/** Opens Space settings > Templates of SPACE. */
export async function openTemplates(page: Page, s: Settings) {
  await openSpaceSettings(page, s, "look-and-feel/templates", "Templates");
  await blueprintTable(page).locator("tr").nth(3).waitFor({ timeout: 30_000 });
  await expandNavGroup(page, "Look and feel");
  await closePopups(page);
}

/** The rows of a blueprint: its bold row and the template rows under it, up to the next blueprint. */
export async function blueprintGroupRows(page: Page, name: string) {
  const idx = await blueprintTable(page).locator("tr").evaluateAll((rows, name) => {
    const start = rows.findIndex((r) => r.querySelector("b")?.textContent?.trim() === name);
    if (start < 0) return [];
    const out = [start];
    for (let i = start + 1; i < rows.length && !rows[i].querySelector("b"); i++) out.push(i);
    return out;
  }, name);
  return idx.map((i) => blueprintTable(page).locator("tr").nth(i));
}

/** The User created templates table (the first table of the Templates page). */
export const userTemplatesTable = (page: Page) => page.locator("#AkMainContent table").first();

/**
 * Display-only stand-in for the lesson's space template "Release readiness digest" (SyncUp has none): replaces the
 * empty-state row of the User created templates table with one row. Fixed date so captures compare.
 */
export async function fakeUserTemplateRow(page: Page, person: string) {
  await userTemplatesTable(page).evaluate((table, person) => {
    const cols = table.querySelectorAll("thead th").length || 5;
    const body = table.querySelector("tbody") ?? table.appendChild(document.createElement("tbody"));
    const initials = person.split(" ").map((w) => w[0]).join("");
    const td = "padding:8px;vertical-align:middle;font-size:14px;color:#292A2E;border-bottom:1px solid #0B120E24";
    const tr = document.createElement("tr");
    tr.setAttribute("data-screenshot-tweak", "fake-template");
    const cells = [
      "Release readiness digest",
      '<span style="font-size:20px;color:#505258">+</span>',
      `<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#0C66E4;color:#fff;font:600 10px sans-serif">${initials}</span>${person}</span>`,
      "April 14, 2023",
      '<span style="color:#505258">&#9998; &#128465;<br>Promote</span>',
    ].slice(0, cols);
    tr.innerHTML = cells.map((c) => `<td style="${td}">${c}</td>`).join("");
    // The empty-state message ("You have no templates specific to this space yet..."): its smallest box
    const holders = Array.from(document.querySelectorAll<HTMLElement>("#AkMainContent *")).filter(
      (el) => /no templates specific/i.test(el.innerText ?? "") && (el.innerText ?? "").length < 400,
    );
    const smallest = holders.filter((el) => !holders.some((o) => o !== el && el.contains(o)));
    for (const el of smallest) (el.closest("tr") ?? el).style.display = "none";
    body.appendChild(tr);
  }, person);
}

// ---------- Page view: More actions, Share ----------

/** The page header's More actions (•••) button. */
export const moreActionsButton = (page: Page) => page.locator("#AkMainContent").getByRole("button", { name: "More actions", exact: true }).first();
/** The More actions menu once open. */
export const moreActionsMenu = (page: Page) => page.getByRole("menu").filter({ has: page.getByRole("menuitem", { name: /Version history|Move|Archive/ }) }).last();

/** Opens the page's More actions menu (nothing in it is clicked). */
export async function openMoreActions(page: Page) {
  await closePopups(page);
  await moreActionsButton(page).click();
  await moreActionsMenu(page).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
}

/** The page header's Share button and the Share dialog. */
export const shareButton = (page: Page) => page.getByRole("button", { name: /^Share/ }).first();
export const shareDialog = (page: Page) => page.getByRole("dialog").filter({ hasText: "General access" }).first();

/** Opens the Share dialog of the page (nothing is typed or changed). */
export async function openShare(page: Page) {
  await closePopups(page);
  await shareButton(page).click();
  await shareDialog(page).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
}

// ---------- Space settings > Space details ----------

/** The Space icon of Space details: its "Edit space icon" button. */
export const editIconButton = (page: Page) => page.locator("#AkMainContent").getByRole("button", { name: "Edit space icon" }).first();

/** Opens Space settings > Space details of SPACE. */
export async function openSpaceDetails(page: Page, s: Settings) {
  await openSpaceSettings(page, s, "details", "Space details");
  await editIconButton(page).waitFor({ timeout: 30_000 });
  await closePopups(page);
}

/** The General access drop-down button of the Share dialog ("Open" or "Restricted"). */
export const generalAccessButton = (page: Page) =>
  shareDialog(page).getByRole("button", { name: /^(Open|Restricted|Anyone|Only specific)/ }).first();
/** The list of General access options once open. */
export const accessOptions = (page: Page) =>
  page.locator('[role="menu"], [role="listbox"], [role="dialog"]').filter({ hasText: /Only specific people/ }).filter({ hasText: /Anyone in this space/ }).last();

/** Opens the General access drop-down (no option is picked). */
export async function openGeneralAccess(page: Page) {
  await generalAccessButton(page).click();
  await accessOptions(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
}

/** Replaces people's names in the Share dialog (suggestion chips, people with access) with fake names. */
export async function fakeShareNames(page: Page, people = FAKE_PEOPLE) {
  await shareDialog(page).evaluate((dlg, people) => {
    const keep = /^(Share|General access|Copy link|Slack|Public link|Can edit|Can view|Open|Restricted|Add names, groups, or emails|Specific access|Anyone.*|Only.*)$/;
    const map = new Map<string, string>();
    // Suggestion chips ("+ Name") and rows of people with access: text next to an avatar or a + icon
    dlg.querySelectorAll<HTMLElement>('button, [role="row"], li, [data-testid*="user"], [data-testid*="suggest"]').forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const v = n.nodeValue?.trim() ?? "";
        if (!v || keep.test(v) || !/^[A-Z][\w'.-]+( [A-Z][\w'.-]+)+( \(.*\))?$/.test(v)) continue;
        if (/bot|Bitbucket|Confluence|Jira/i.test(v)) continue;
        if (!map.has(v)) map.set(v, people[map.size % people.length]);
        n.nodeValue = n.nodeValue!.replace(v, map.get(v)!);
      }
    });
  }, people);
}

// ---------- Profile menu ----------

/** The profile button at the top right. Its label is the account's initials and email (never printed). */
export const profileButton = (page: Page) => page.getByRole("button", { name: /[\w.+-]+@[\w-]+\.[\w.-]+/ }).first();
/** The profile menu once open. */
export const profileMenu = (page: Page) =>
  page.locator('[role="menu"], [role="dialog"], [data-testid*="profile"][data-testid*="content"]').filter({ hasText: /Log out/ }).last();

/** Opens the profile menu. */
export async function openProfileMenu(page: Page) {
  await closePopups(page);
  await profileButton(page).click();
  await profileMenu(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
}

/** Replaces any email address in the profile menu with a fake one for the fake person. */
export async function fakeProfileEmail(page: Page, person: string) {
  const email = `${person.split(" ")[0][0]}${person.split(" ").slice(-1)[0]}@example.com`.toLowerCase();
  await page.evaluate((email) => {
    const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue && re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, email);
  }, email);
}

// ---------- Space sidebar ----------

export const sideNav = (page: Page) => page.locator("#side-navigation");
/** A row of the space sidebar ("Shortcuts", "Content") by its button text. */
export const sideRow = (page: Page, name: string) => sideNav(page).getByRole("button", { name, exact: true }).first();
/** The Content "+" (Create) button of the space sidebar: the "Create" button on the Content row. Never clicked. */
export const contentCreateButton = (page: Page) => sideNav(page).locator('[data-screenshot-area="content-create"]');

/** Marks the Content row's "+" button (the sidebar has other "Create" buttons, e.g. at the end of the page tree). */
export async function markContentCreate(page: Page) {
  const row = await sideRow(page, "Content").boundingBox();
  if (!row) return;
  // Its accessible name is "Create" or "Create Create" (icon label plus text)
  await sideNav(page).getByRole("button", { name: /^Create( Create)?$/ }).evaluateAll((bs, row) => {
    const mid = row.y + row.height / 2;
    const b = bs.find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.top < mid && r.bottom > mid;
    });
    b?.setAttribute("data-screenshot-area", "content-create");
  }, row);
}

// ---------- Editor (existing page; nothing typed, nothing published) ----------

/** The editor's Update (publish) button. Never clicked. */
export const updateButton = (page: Page) =>
  page.getByTestId("publish-modal-update-button").or(page.getByRole("button", { name: /^(Update|Publish)$/ })).first();
/** The arrow right after the Update button ("Update settings": Update without notifying watchers, Adjust update settings). */
export const updateChevron = (page: Page) =>
  page.getByTestId("publish-modal-chevron-button").or(updateButton(page).locator("xpath=following::button[1]")).first();
/** The Update page dialog opened from the arrow. */
export const updateDialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Version comments|Notify watchers|Schedule/ }).last();

/**
 * Draws a blueprint toggle as switched off (grey, knob left, cross icon), display-only: the real toggle is
 * covered, never clicked, and no event is sent, so nothing is saved.
 */
export async function fakeToggleOff(page: Page, toggle: Locator) {
  await toggle.evaluate((input) => {
    const label = input.closest("label") as HTMLElement;
    const r = label.getBoundingClientRect();
    label.style.position = "relative";
    Array.from(label.children).forEach((c) => ((c as HTMLElement).style.visibility = "hidden"));
    const off = document.createElement("span");
    off.setAttribute("data-screenshot-tweak", "toggle-off");
    const h = Math.round(r.height) || 16;
    const w = Math.round(r.width) || 32;
    off.style.cssText =
      `position:absolute;left:0;top:0;width:${w}px;height:${h}px;border-radius:${h}px;background:#8C8F97;` +
      "display:flex;align-items:center;justify-content:flex-end;box-sizing:border-box;padding:0 4px;visibility:visible";
    off.innerHTML =
      `<span style="position:absolute;left:2px;top:2px;width:${h - 4}px;height:${h - 4}px;border-radius:50%;background:#fff"></span>` +
      `<span style="color:#fff;font:700 ${Math.max(9, h - 6)}px/1 sans-serif">&#215;</span>`;
    label.appendChild(off);
  });
}

/** Marks the pictures of app and user class rows in the Users list as not people, so anonymize() keeps them. */
export async function keepAppIcons(page: Page) {
  await usersTable(page).locator("tbody tr").evaluateAll((rows) => {
    for (const r of rows) {
      if (/\n\s*(App|User class|Group)\s*(\n|$)/.test((r as HTMLElement).innerText)) r.setAttribute("data-screenshot-keep", "");
    }
  });
}

/** The top bar's Create button (never clicked: it can create a draft). Marked by position, as the top bar has no landmark. */
export async function topCreateButton(page: Page) {
  await page.getByRole("button", { name: /^Create$/ }).evaluateAll((bs) => {
    const top = bs.find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.top < 60;
    });
    top?.setAttribute("data-screenshot-area", "top-create");
  });
  return page.locator('[data-screenshot-area="top-create"]');
}
