import { Locator, Page } from "@playwright/test";
import { Blocked, Checks } from "./recipe";
import { Settings } from "./supabase";
import { openSignedIn } from "./jira";
import { closeTours, jiraPeopleTweaks } from "./b2-jira";
import { hideMessages } from "./tweaks";

// Helpers for the batch 3 Jira administration recipes (AUC-13016, AUC-13079, AUC-13464, AUC-606, AUC-612, AUC-649).
// Everything here is read only: pages and dialogs are opened, nothing is saved.

/** Text that means Jira asks for a secure administrator session (password re-entry). Never answered. */
const REAUTH = /secure administrator session|administrator access|re-?enter your password|confirm your password|verify (it's|it is) you/i;

/** Fails as blocked when an admin re-authentication prompt is showing (the recipe never types a password). */
export async function failOnReauth(page: Page) {
  const prompt = page.getByText(REAUTH).first();
  if (await prompt.isVisible().catch(() => false)) throw new Blocked("Admin re-authentication requested (secure administrator session); not answered");
}

/**
 * Opens a Jira admin or space settings page through sign-in and waits for its heading.
 * `ready` is the element that shows the page has loaded (usually a heading).
 */
export async function openSettingsPage(page: Page, s: Settings, path: string, ready: Locator, what: string) {
  await openSignedIn(page, s, path);
  await ready.or(page.getByText(REAUTH)).first().waitFor({ timeout: 90_000 }).catch(() => {});
  await failOnReauth(page);
  if (!(await ready.first().isVisible().catch(() => false))) {
    const denied = await page.getByText(/don't have (access|permission)|isn't available|can't find/i).first().isVisible().catch(() => false);
    if (denied) throw new Blocked(`Test data: the test account cannot open ${what}`);
    throw new Error(`${what} did not load`);
  }
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await closeTours(page);
}

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A heading (h1 to h4, or role heading) whose text is exactly this (help icons next to it are ignored). */
export const heading = (page: Page, text: string) =>
  page.locator("h1:visible, h2:visible, h3:visible, h4:visible, [role=heading]:visible").filter({ hasText: new RegExp(`^\\s*${esc(text)}\\s*(Get help!?)?\\s*$`) }).first();

/** The settings sidebar (Jira admin settings or Space settings). */
export const settingsSidebar = (page: Page) =>
  page.locator('[data-testid="side-nav-view"], nav[aria-label="Sidebar"], #ak-side-navigation, [data-testid="page-layout.sidebar"]').first();

/** A sidebar link with this label (visible). */
export const sidebarLink = (page: Page, label: string) =>
  page.locator("nav a:visible, nav [role=link]:visible, nav button:visible").filter({ hasText: new RegExp(`^\\s*${esc(label)}\\s*$`) }).first();

/** Page text outside the sidebar navigation. */
export async function mainText(page: Page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("nav").forEach((n) => n.remove());
    document.body.appendChild(clone);
    clone.style.cssText = "position:absolute;left:-99999px;top:0;width:1280px";
    const t = clone.innerText;
    clone.remove();
    return t;
  });
}

/** Scrolls the settings sidebar (not the window) so that this item is in view, near the bottom like the lessons. */
export async function scrollSidebarTo(page: Page, label: string) {
  await sidebarLink(page, label).evaluate((el) => {
    let p: HTMLElement | null = el.parentElement;
    while (p && !(p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    if (!p) return;
    const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
    if (r.top < pr.top || r.bottom > pr.bottom) p.scrollTop += r.bottom - pr.bottom + 40;
  });
  await page.waitForTimeout(500);
}

/** Check: all these texts are in the main area. */
export async function checkTexts(c: Checks, page: Page, name: string, texts: string[], scope?: Locator) {
  await c.check(name, async () => {
    const text = scope ? await scope.innerText() : await mainText(page);
    const missing = texts.filter((t) => !text.includes(t));
    return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
  });
}

/** Check: the settings sidebar shows these items and `selected` is the current page. */
export async function checkSidebar(c: Checks, page: Page, name: string, items: string[], selected: string) {
  await c.check(name, async () => {
    const nav = await page.locator("nav").allInnerTexts();
    const text = nav.join("\n");
    const missing = items.filter((t) => !text.split("\n").some((l) => l.trim() === t));
    const current = await page
      .locator('nav [aria-current="page"], nav [aria-current="true"]')
      .allInnerTexts()
      .then((a) => a.map((t) => t.trim()).filter(Boolean));
    const isSelected = current.some((t) => t.split("\n")[0].trim() === selected);
    return {
      pass: !missing.length && isSelected,
      detail: `${missing.length ? `Missing: ${missing.join(", ")}; ` : ""}selected: ${current.map((t) => t.split("\n")[0]).join(", ") || "none"}`,
    };
  });
}

/** Check: the "Switch settings" dropdown of Jira admin settings shows this section. */
export async function checkSwitchSettings(c: Checks, page: Page, section: string) {
  await c.check(`Jira admin settings sidebar, Switch settings set to '${section}'`, async () => {
    const text = (await page.locator("nav").allInnerTexts()).join("\n");
    const title = text.includes("Jira admin settings");
    const sw = await page.getByText("Switch settings", { exact: true }).first().locator("xpath=following::button[1]").innerText().catch(() => "");
    return { pass: title && sw.trim() === section, detail: `Title: ${title}; Switch settings: "${sw.trim()}"` };
  });
}

/** Banners Jira admin pages show to some accounts that lessons never show (display only). */
export async function hideAdminBanners(page: Page) {
  await hideMessages(page, ["Your team is using", "Join your team"]);
}

/**
 * The cookie consent banner some sessions get at the top of Jira (display only: no consent choice is clicked).
 * Jira reserves its height in the page grid (--bannerHeight), so that space is closed too.
 */
export async function hideCookieBanner(page: Page) {
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll<HTMLElement>("body *")).find(
      (e) => e.childElementCount < 20 && /^Atlassian uses cookies/.test((e.innerText ?? "").trim()) && e.getBoundingClientRect().top < 5,
    );
    if (!el) return;
    let box = el;
    while (box.parentElement && box.parentElement !== document.body && box.parentElement.getBoundingClientRect().height < 200) box = box.parentElement;
    box.style.setProperty("display", "none", "important");
    document.documentElement.style.setProperty("--bannerHeight", "0px");
  });
  await page.waitForTimeout(300);
}

/** Usual tweaks for Jira admin and space settings pages: org name, signed-in user, people, avatars, banners. */
export async function jadminTweaks(page: Page, s: Settings) {
  await hideCookieBanner(page);
  await hideAdminBanners(page);
  await jiraPeopleTweaks(page, s);
}

/** Scrolls an element to the top part of the window (like the lesson's scrolled views) and waits for it to settle. */
export async function scrollToShow(page: Page, el: Locator, topOffset = 0) {
  await el.scrollIntoViewIfNeeded();
  if (topOffset)
    await el.evaluate((e, off) => {
      const r = e.getBoundingClientRect();
      // Walk up to the first scrolling ancestor (admin pages scroll the main panel, not the window)
      let p: HTMLElement | null = e.parentElement;
      while (p && !(p.scrollHeight > p.clientHeight && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
      (p ?? document.scrollingElement!).scrollBy(0, r.top - off);
    }, topOffset);
  await page.waitForTimeout(500);
}

/**
 * Dashboard gadgets print people as plain text (Issue Statistics rows, "Lead" in the Projects gadget, assignee
 * columns), which fakeProfileNames() misses. Collects those names and swaps them for fake ones everywhere on the
 * page (display only), the same fake for the same person. Also turns gadget avatars into blank circles.
 */
export async function fakeGadgetPeople(page: Page, people: string[]) {
  await page.evaluate((people) => {
    const isName = (t: string) => /^[A-Z][\w'.-]+( [A-Z][\w'.-]+){1,2}$/.test(t) && !/^(Total|Unassigned|No |Open |All )/.test(t);
    const found = new Set<string>();
    // Issue Statistics style tables: first column of each row under a "Assignee"/"Reporter"/"Lead" header
    document.querySelectorAll("table").forEach((tb) => {
      const head = (tb.querySelector("th")?.textContent ?? "").trim();
      if (!/^(Assignee|Reporter|Lead|Creator|Project lead)$/i.test(head)) return;
      tb.querySelectorAll("tr td:first-child").forEach((td) => {
        const t = (td.textContent ?? "").trim();
        if (isName(t)) found.add(t);
      });
    });
    // "Lead" label followed by a name (Projects gadget)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
    texts.forEach((n, i) => {
      if ((n.nodeValue ?? "").trim() !== "Lead") return;
      for (let j = i + 1; j < Math.min(i + 4, texts.length); j++) {
        const t = (texts[j].nodeValue ?? "").trim();
        if (!t) continue;
        if (isName(t)) found.add(t);
        break;
      }
    });
    // Links to user profiles
    document.querySelectorAll('a[href*="/people/"], a[href*="ViewProfile"], a[href*="secure/ViewProfile"]').forEach((a) => {
      const t = (a.textContent ?? "").trim();
      if (isName(t)) found.add(t);
    });
    const map = new Map(Array.from(found).map((n, i) => [n, people[i % people.length]]));
    const swap = (v: string) => { for (const [n, f] of map) v = v.split(n).join(f); return v; };
    texts.forEach((n) => { if (n.nodeValue) n.nodeValue = swap(n.nodeValue); });
    document.querySelectorAll("[title],[aria-label],img[alt]").forEach((el) => {
      for (const a of ["title", "aria-label", "alt"]) { const v = el.getAttribute(a); if (v) el.setAttribute(a, swap(v)); }
    });
  }, people);
}

/** The Add people button of a space's Access page. */
export const addPeopleButton = (page: Page) => page.getByRole("button", { name: "Add people", exact: true }).first();

/** Opens Space settings > Access of a team-managed business space (e.g. EO). */
export async function openSpaceAccess(page: Page, s: Settings, key: string) {
  await openSettingsPage(page, s, `/jira/core/projects/${key}/settings/access`, addPeopleButton(page), `Access of space ${key}`);
}

/** Plain-text person names (two or three capitalised words next to an avatar) inside `scope`, swapped for fake ones page-wide
 *  (display only), the same fake for the same person. Names already in `people` are left alone. */
export async function fakeNamesIn(page: Page, scope: Locator, people: string[]) {
  const els = await scope.elementHandles();
  await page.evaluate(
    ([els, people]) => {
      const isName = (t: string) => /^[A-Z][a-z'-]+( [A-Z][a-z'-]+){1,2}$/.test(t) && !people.includes(t);
      // Only names shown next to an avatar (people pickers, user lists), never links or titles
      const nearAvatar = (n: Node) => {
        let p = n.parentElement;
        for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
          if (p.closest("a")) return false;
          if (p.querySelector('img, [role="img"]:not(svg)')) return true;
        }
        return false;
      };
      const found = new Set<string>();
      for (const el of els as Element[]) {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const t = (n.nodeValue ?? "").trim();
          if (isName(t) && nearAvatar(n)) found.add(t);
        }
      }
      const map = new Map(Array.from(found).map((n, i) => [n, people[i % people.length]]));
      const swap = (v: string) => { for (const [n, f] of map) v = v.split(n).join(f); return v; };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
      document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
        for (const a of ["aria-label", "title", "alt"]) { const v = el.getAttribute(a); if (v) el.setAttribute(a, swap(v)); }
      });
    },
    [els, people] as const,
  );
}
