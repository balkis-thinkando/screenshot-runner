import { Locator, Page, test } from "@playwright/test";
import { Checks } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { closeTours } from "./b2-jira";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "./tweaks";

// Helpers for the batch 3 Jira Service Management recipes (queues, help center, services, SLAs, forms, knowledge
// base, Assets). Test site stand-ins (Nov 2026): the IT Support (ITS) service space and the system Assets schemas
// (Hardware assets, People). Nothing here clicks Save, Create, Add or Delete.

/** The IT Support service space used instead of the lessons' spaces. */
export const ITS = { key: "ITS", name: "IT Support", portalId: 1 };
/** An ITS request with running SLAs (Time to resolution, Time to first response), Nov 2026. */
export const ITS_SLA_ITEM = "ITS-6256";
/** The ITS "All open tickets" queue. */
export const ITS_ALL_OPEN = "/jira/servicedesk/projects/ITS/queues/custom/1";
/** Assets system schemas on the test site: People (A_PEOP, object A_PEOP-3) and Hardware assets (A_HA). */
export const PEOPLE_SCHEMA = 4;
export const HARDWARE_SCHEMA = 3;
export const PEOPLE_OBJECT = { id: 3, key: "A_PEOP-3" };
/** The lessons' fake person for the Assets People object (display only). */
export const LESSON_PERSON = "Ellie Singh";

/** Opens a site page signed in, waits for `ready`, then for the network to settle and closes feature tours. */
export async function openAndWait(page: Page, s: Settings, path: string, ready: (page: Page) => Locator, timeout = 150_000) {
  // Assets and JSM settings pages can take over a minute to render on the test site (Nov 2026: 80 s for a schema tree)
  const info = test.info();
  if (info.timeout && info.timeout < 240_000) info.setTimeout(240_000);
  // Sign-in sometimes takes over a minute to hand back to the site under load: try once more before calling it expired
  await openSignedIn(page, s, path).catch(() => openSignedIn(page, s, path));
  await ready(page).first().waitFor({ timeout });
  await settle(page);
}

/** Waits for the network to settle, closes a feature tour and parks the mouse. */
export async function settle(page: Page, ms = 2_000) {
  // Assets and queue pages poll, so they may never be idle: wait a little, not the full test time
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(ms);
  await closeTours(page);
  await page.mouse.move(1279, 799);
}

/**
 * Replaces the names of the site's people (Jira users and customers, as listed by the users API) everywhere on the
 * page with fake names, the same fake for the same person. Catches names shown as plain text (queue Reporter
 * columns, help center "raised this", Assets People objects named after demo accounts). Display only; the names are
 * never printed.
 */
export async function fakeSiteUsers(page: Page, people = FAKE_PEOPLE) {
  await page.evaluate(async (people) => {
    const all: string[] = [];
    for (let start = 0; start < 2000; start += 1000) {
      const batch = await fetch(`/rest/api/3/users/search?maxResults=1000&startAt=${start}`, { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      for (const u of batch as { accountType?: string; displayName?: string }[])
        if (u.accountType !== "app" && u.displayName && /\S\s+\S/.test(u.displayName) && !people.includes(u.displayName)) all.push(u.displayName);
      if ((batch as unknown[]).length < 1000) break;
    }
    // Longest first, so a name that contains another one is replaced whole
    const names = Array.from(new Set(all)).sort((a, b) => b.length - a.length);
    const body = document.body.innerText + " " + Array.from(document.querySelectorAll("[aria-label],[title],img[alt]")).map((e) => e.getAttribute("aria-label") ?? e.getAttribute("title") ?? e.getAttribute("alt")).join(" ");
    const shown = names.filter((n) => body.includes(n));
    const map = new Map(shown.sort((a, b) => body.indexOf(a) - body.indexOf(b)).map((n, i) => [n, people[i % people.length]]));
    if (!map.size) return;
    const ordered = Array.from(map.keys()).sort((a, b) => b.length - a.length);
    const swap = (v: string) => { for (const n of ordered) if (v.includes(n)) v = v.split(n).join(map.get(n)!); return v; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
    document.querySelectorAll<HTMLInputElement>("input").forEach((i) => { if (i.value) i.value = swap(i.value); });
  }, people);
}

/** The usual JSM tweaks: org name, signed-in user, site people (plain text and profile cards), avatars. */
export async function jsmTweaks(page: Page, s: Settings, me = FAKE_PEOPLE[5]) {
  await renameOrg(page, s.test_org, s.display_org_name);
  await fakeSignedInUser(page, me);
  const others = FAKE_PEOPLE.filter((n) => n !== me);
  await fakeSiteUsers(page, others);
  await fakeProfileNames(page, others);
  const initials = me.split(" ").map((w) => w[0]).join("");
  await anonymize(page, initials, FAKE_PEOPLE);
  // The sidebar's "Your team is using Jira Product Discovery" promo (site-specific, not in the lessons)
  await hideTip(page, "Your team is using", 140);
}

/** Visible text of the first match (empty when missing). */
export const textOf = async (l: Locator) => ((await l.first().innerText({ timeout: 5_000 }).catch(() => "")) ?? "").trim();

/** Main content area of the page (the body when the page has no main landmark). */
export const mainArea = (page: Page) => page.locator("main, [role=main], body:not(:has(main, [role=main]))").first();

/** One check that the given texts are all shown in `scope` (default: the whole page). */
export async function checkTexts(c: Checks, name: string, page: Page, texts: string[], scope?: Locator, why = "") {
  await c.check(name, async () => {
    const text = await (scope ?? page.locator("body")).first().innerText().catch(() => "");
    const missing = texts.filter((t) => !text.includes(t));
    return { pass: !missing.length, detail: missing.length ? `${why}Missing: ${missing.join(", ")}` : "All present" };
  });
}

/** One check that a heading (h1/h2 or role heading) with the text is visible. */
export async function checkHeading(c: Checks, name: string, page: Page, heading: string | RegExp, scope?: Locator) {
  await c.check(name, async () => {
    const h = (scope ?? page).getByRole("heading", { name: heading }).first();
    const v = await h.isVisible().catch(() => false);
    const all = (await (scope ?? page).getByRole("heading").allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean).slice(0, 6);
    return { pass: v, detail: v ? "Present" : `Not found; headings: ${all.join(" / ").slice(0, 200)}` };
  });
}

/** One check that a button or link with the name is visible. */
export async function checkControl(c: Checks, name: string, page: Page, label: string | RegExp, scope?: Locator) {
  await c.check(name, async () => {
    const root = scope ?? page;
    const v = await root.getByRole("button", { name: label }).or(root.getByRole("link", { name: label })).or(root.getByRole("tab", { name: label })).first().isVisible().catch(() => false);
    return { pass: v, detail: v ? "Present" : "Missing" };
  });
}

/** Column headers of the first table in scope, first line of each. */
export async function columns(scope: Page | Locator) {
  return (await scope.locator("table thead th, [role=columnheader]").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
}

/** Sidebar of a service space: the first visible link or button whose whole text is the name (category items such
 *  as Service requests are buttons, Nov 2026). */
export const sidebarItem = (page: Page, name: string | RegExp) => {
  const text = typeof name === "string" ? new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) : name;
  return page.locator(":is(a, button, [role=button]):visible").filter({ hasText: text }).first();
};

/** Assets: the schema tree item (link) for an object type. */
export const treeItem = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).first();

/**
 * Opens an Assets schema at an object type (by type id) and waits for the schema tree. With `table`, switches the object
 * list from the detail view (opened on the first object) to the table the lessons show ("List view" button: a display
 * mode, nothing is saved to the site).
 */
export async function openSchema(page: Page, s: Settings, schemaId: number, typeId?: number, table = false) {
  await openAndWait(page, s, `/jira/assets/object-schema/${schemaId}${typeId ? `?typeId=${typeId}` : ""}`, (p) => p.getByText(/schema tree/i));
  await viewMode(page, "Objects").waitFor({ timeout: 20_000 }).catch(() => {});
  if (table) await showObjectTable(page);
}

/** Switches the object list to the table (when it shows one object's details). */
export async function showObjectTable(page: Page) {
  const toggle = page.getByRole("button", { name: "List view" }).first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.locator("table thead, [role=columnheader]").first().waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
  }
  await page.mouse.move(1279, 799);
}

/** One check that buttons with these accessible names are visible (icon buttons have no text). */
export async function checkButtons(c: Checks, name: string, page: Page, labels: string[], scope?: Locator) {
  await c.check(name, async () => {
    const missing: string[] = [];
    for (const l of labels) if (!(await (scope ?? page).getByRole("button", { name: l }).first().isVisible().catch(() => false))) missing.push(l);
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });
}

/** "Assets is more available than ever" and similar banners in the Assets sidebar (display only). */
export async function hideAssetsBanners(page: Page) {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("nav *, aside *"))) {
      const t = el.innerText?.trim() ?? "";
      if (t.startsWith("Assets is more available than ever") && el.getBoundingClientRect().height < 250) {
        let box = el;
        while (box.parentElement && box.parentElement.innerText.trim().startsWith("Assets is more available") && box.parentElement.getBoundingClientRect().height < 250) box = box.parentElement;
        box.style.display = "none";
        return;
      }
    }
  });
}

/** Replaces text in text nodes under `scope` (display only), e.g. a lesson's sample name. */
export async function setTexts(scope: Locator, from: string, to: string) {
  await scope.first().evaluate(
    (el, [from, to]) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.includes(from)) n.nodeValue = n.nodeValue.split(from).join(to);
      el.querySelectorAll<HTMLInputElement>("input").forEach((i) => { if (i.value.includes(from)) i.value = i.value.split(from).join(to); });
    },
    [from, to] as const,
  );
}

/** Rows of the queue (work item list): a virtual table of divs (Nov 2026), or a plain table. */
export const queueRows = (page: Page) => page.locator('[data-testid$="rows.common.default-row"]').or(page.locator("main table tbody tr"));

/** Opens the ITS "All open tickets" queue and waits for its rows. */
export async function openItsQueue(page: Page, s: Settings) {
  await openAndWait(page, s, ITS_ALL_OPEN, (p) => p.getByRole("heading", { name: "All open tickets" }));
  await queueRows(page).first().waitFor({ timeout: 60_000 });
  await settle(page);
}

/** Checks shared by the queue shots: breadcrumbs and title, then the columns that exist in every lesson version. */
export async function queueChecks(c: Checks, page: Page, cols = ["T", "Key", "Request Type", "P", "Summary", "Reporter"]) {
  await c.check("Breadcrumbs Spaces / IT Support / Queues and heading 'All open tickets'", async () => {
    const h = await page.getByRole("heading", { name: "All open tickets" }).first().isVisible().catch(() => false);
    const text = await mainArea(page).innerText().catch(() => "");
    const crumbs = text.includes("IT Support") && text.includes("Queues");
    return { pass: h && crumbs, detail: `Heading: ${h}; breadcrumbs: ${crumbs}` };
  });
  await c.check(`Columns: ${cols.join(", ")}`, async () => {
    const got = await columns(page);
    const missing = cols.filter((w) => !got.includes(w));
    return { pass: !missing.length, detail: `Columns: ${got.join(", ").slice(0, 200)}${missing.length ? `; missing: ${missing.join(", ")}` : ""}` };
  });
  await c.check("Work items listed", async () => {
    const n = await queueRows(page).count();
    return { pass: n > 0, detail: `${n} rows (test data: ITS has few open work items)` };
  });
}

/** Masks for queue shots: the rows and the work item count change over time. */
export const queueMask = (page: Page) => [queueRows(page), page.getByText(/^\d+ work items?$/)];

/** Assets: the Objects / Attributes switch of an object type (radio buttons). */
export const viewMode = (page: Page, name: "Objects" | "Attributes") =>
  page.locator(`[data-testid="servicedesk-insight-object-schema-page.view-mode-switcher.${name === "Objects" ? "object" : "attribute"}"]`).or(page.getByRole("radio", { name, exact: true })).first();

/** Hides a small message (e.g. the search dropdown's "Rovo tip") by its first words: the largest ancestor under
 *  `maxHeight` px, so the dialog around it stays. Display only. */
export async function hideTip(page: Page, startsWith: string, maxHeight = 80) {
  await page.evaluate(
    ([start, max]) => {
      // The largest element starting with the text that is still under maxHeight (the tip's own box)
      const boxes = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((e) => {
        const h = e.getBoundingClientRect().height;
        return h > 0 && h < max && (e.innerText ?? "").trim().startsWith(start);
      });
      const box = boxes.sort((a, b) => b.getBoundingClientRect().height * b.getBoundingClientRect().width - a.getBoundingClientRect().height * a.getBoundingClientRect().width)[0];
      if (box) box.style.display = "none";
    },
    [startsWith, maxHeight] as const,
  );
}

/** The locators (or groups) that are visible, for spotlightAreas() (it waits forever on a missing one). */
export async function visibleAreas(areas: (Locator | Locator[])[]) {
  const out: (Locator | Locator[])[] = [];
  for (const a of areas) {
    const list = Array.isArray(a) ? a : [a];
    const shown: Locator[] = [];
    for (const l of list) if (await l.first().isVisible().catch(() => false)) shown.push(l.first());
    if (shown.length) out.push(Array.isArray(a) ? shown : shown[0]);
  }
  return out;
}

/** Outlines one item like the lesson (spotlight without markers), skipped when the item is not shown. */
export async function outline(page: Page, item: Locator) {
  if (await item.first().isVisible().catch(() => false)) await spotlight(page, item.first(), { markers: false });
}
