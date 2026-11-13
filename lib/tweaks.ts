import { Locator, Page } from "@playwright/test";

// Page tweaks run in the browser just before capture.
// They only change what is displayed; nothing is saved to the account.

/** Replaces every visible occurrence of one name with another (text, titles, labels). */
export async function renameOrg(page: Page, from: string, to: string) {
  await page.evaluate(([from, to]) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue?.includes(from)) n.nodeValue = n.nodeValue.replaceAll(from, to);
    }
    document.querySelectorAll(`[aria-label*="${from}"],[title*="${from}"]`).forEach((el) => {
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v?.includes(from)) el.setAttribute(a, v.replaceAll(from, to));
      }
    });
    document.title = document.title.replaceAll(from, to);
  }, [from, to]);
}

/** Realistic fake names for the people in screenshots. The first ones are the names the lessons use.
 *  Not real accounts: Cassi Owens, Max Taylor, Mitch Davis and Alana Grant are real on the training sites, so they're not here. */
export const FAKE_PEOPLE = [
  "Andrea Wilson", "Orion Beck", "Phil Mabrey", "Jennifer Evans", "Emma Rose", "Kevin Campbell",
  "Priya Shah", "Daniel Okafor", "Sofia Martins", "Liam Chen", "Grace Kim", "Noah Bennett",
];

/** FAKE_PEOPLE, starting with the given names (e.g. the ones the lesson image shows). */
export const fakePeople = (...first: string[]) => [...first, ...FAKE_PEOPLE.filter((n) => !first.includes(n))];

/** Replaces the names of the people with a profile card ("More information about ...") with fake names, the same name
 *  for the same person, everywhere on the page. */
export async function fakeProfileNames(page: Page, people = FAKE_PEOPLE) {
  await page.evaluate((people) => {
    // Safety net: a profile picture that re-renders after anonymize() stays hidden
    const style = document.createElement("style");
    style.setAttribute("data-screenshot-tweak", "people");
    style.textContent = 'img[src*="/aa-avatar/"] { visibility: hidden !important; }';
    document.head.appendChild(style);
    const prefix = "More information about ";
    const real = Array.from(document.querySelectorAll(`[aria-label^="${prefix}"]`))
      .map((el) => el.getAttribute("aria-label")!.slice(prefix.length).trim())
      .filter((n) => n && n !== "this user");
    const names = new Map(Array.from(new Set(real)).map((n, i) => [n, people[i % people.length]]));
    const swap = (v: string) => { for (const [n, f] of names) v = v.replaceAll(n, f); return v; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) n.nodeValue = swap(n.nodeValue);
    document.querySelectorAll("[aria-label],[title],img[alt]").forEach((el) => {
      for (const a of ["aria-label", "title", "alt"]) {
        const v = el.getAttribute(a);
        if (v) el.setAttribute(a, swap(v));
      }
    });
  }, people);
}

/** Replaces email addresses and profile pictures with neutral placeholders.
 *  With `people` (fake names already on the page), a picture next to one of those names gets that person's initials. */
export async function anonymize(page: Page, initials = "AU", people: string[] = []) {
  await page.evaluate(([initials, people]) => {
    const email = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue && email.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(email, "user@example.com");
    }
    document.querySelectorAll("[aria-label],[title]").forEach((el) => {
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && email.test(v)) el.setAttribute(a, v.replace(email, "User"));
      }
    });
    // Profile pictures: Atlassian serves them from .../avatar, .../aa-avatar or gravatar
    // ...but not work type, space or request type icons, which Jira also serves from .../universal_avatar/view/type/...
    const icon = /\/view\/type\/(issuetype|project|SD_REQTYPE)|issuetype/i;
    // Colours of Atlassian's own initials avatars
    const colours = ["#0C66E4", "#E56910", "#6E5DC6", "#1F845A", "#C9372C", "#206A83"];
    const personNear = (el: Element) => {
      // The closest container with exactly one of the names; one with several is a list, so stop there
      for (let a = el.parentElement, i = 0; a && i < 5; a = a.parentElement, i++) {
        const found = people.map((n, p) => (a!.textContent?.includes(n) ? p : -1)).filter((p) => p >= 0);
        if (found.length) return found.length === 1 ? found[0] : -1;
      }
      return -1;
    };
    document.querySelectorAll<HTMLImageElement>('img[src*="avatar"]').forEach((img) => {
      if (icon.test(img.getAttribute("src") ?? "")) return;
      // Pictures a recipe marked as not a person (e.g. Rovo agent icons, also served as avatars)
      if (img.closest("[data-screenshot-keep]")) return;
      const { width, height } = img.getBoundingClientRect();
      const p = personNear(img);
      const span = document.createElement("span");
      span.textContent = p >= 0 ? people[p].split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : initials;
      span.style.cssText =
        `display:inline-flex;align-items:center;justify-content:center;width:${width || 24}px;` +
        `height:${height || 24}px;border-radius:50%;background:${p >= 0 ? colours[p % colours.length] : "#1D2125"};` +
        `color:#fff;font:600 ${Math.min(10, Math.round((height || 24) * 0.45))}px sans-serif;white-space:nowrap;overflow:hidden`;
      img.replaceWith(span);
    });
  }, [initials, people] as const);
}

/** Hides small floating buttons pinned to the bottom-right corner (e.g. the Rovo button); lessons don't show them. */
export async function hideFloatingButtons(page: Page) {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (getComputedStyle(el).position !== "fixed" || el.closest("[data-screenshot-tweak]")) continue;
      const r = el.getBoundingClientRect();
      const small = r.width > 0 && r.width < 120 && r.height < 120;
      if (small && r.right > innerWidth - 120 && r.bottom > innerHeight - 120) el.style.visibility = "hidden";
    }
  });
}

/** Hides banners, onboarding messages or pop-ups that start with any of the given texts. */
export async function hideMessages(page: Page, startsWith: string[]) {
  await page.evaluate((starts) => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const text = el.innerText?.trim() ?? "";
      if (text.length > 600 || !starts.some((s) => text.startsWith(s))) continue;
      let box = el.closest<HTMLElement>('[role="dialog"],section,[data-testid]') ?? el;
      // A test id far up the page (e.g. the main area) is not the message: take the largest small ancestor instead
      if (box.getBoundingClientRect().height > 400) {
        box = el;
        while (box.parentElement && box.parentElement.getBoundingClientRect().height < 250) box = box.parentElement;
      }
      box.style.display = "none";
    }
  }, startsWith);
}

/**
 * Lesson-style annotation: dims the page except the given items, outlines them in orange and
 * (optionally) adds a hotspot marker to each item: a dot after its label and a line running right.
 * Matches the labelled-graphic images (overlay 50% black, orange #FCA700).
 * `items` sets the outlined area; `markersOn` puts the markers on other elements (default: the items).
 */
export async function spotlight(
  page: Page,
  items: string | Locator,
  opts: { markers?: boolean; markersOn?: Locator; lineLengths?: number[] } = {},
) {
  const itemsLocator = typeof items === "string" ? page.locator(items) : items;
  const boxEls = await itemsLocator.elementHandles();
  const markEls = opts.markers === false ? [] : await (opts.markersOn ?? itemsLocator).elementHandles();
  await page.evaluate(
    ([boxEls, markEls, lineLengths]) => {
      const orange = "#FCA700";
      const visible = (el: Element) => el.getBoundingClientRect().width > 0;
      const rects = (boxEls as HTMLElement[]).filter(visible).map((el) => el.getBoundingClientRect());
      if (!rects.length) throw new Error("spotlight: no visible items to outline");
      const pad = 4;
      const box = {
        left: Math.min(...rects.map((r) => r.left)) - pad,
        top: Math.min(...rects.map((r) => r.top)) - pad,
        right: Math.max(...rects.map((r) => r.right)) + pad,
        bottom: Math.max(...rects.map((r) => r.bottom)) + pad,
      };
      const add = (css: string) => {
        const d = document.createElement("div");
        d.setAttribute("data-screenshot-tweak", "spotlight");
        d.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;${css}`;
        document.body.appendChild(d);
      };
      // The huge shadow dims everything outside the box
      add(
        `left:${box.left}px;top:${box.top}px;width:${box.right - box.left}px;height:${box.bottom - box.top}px;` +
          `border:3px solid ${orange};border-radius:12px;box-sizing:border-box;box-shadow:0 0 0 9999px rgba(0,0,0,.5)`,
      );
      (markEls as HTMLElement[]).filter(visible).forEach((el, i) => {
        // Right edge of the label, including a badge right next to it ("Transition to roles New") but not a
        // badge pushed to the far right of the item ("Usage ... New")
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue?.trim() ? 1 : 3) });
        const rectOf = (n: Node) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return range.getBoundingClientRect();
        };
        const first = walker.nextNode();
        let text = first ? rectOf(first) : el.getBoundingClientRect();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const next = rectOf(n);
          if (next.left - text.right > 30 || Math.abs(next.top + next.height / 2 - (text.top + text.height / 2)) > 8) break;
          text = new DOMRect(text.left, text.top, next.right - text.left, text.height);
        }
        const y = text.top + text.height / 2;
        const x = text.right + 10;
        const length = lineLengths[i % lineLengths.length];
        add(`left:${x}px;top:${y - 1.5}px;width:${box.right + length - x}px;height:3px;background:${orange}`);
        add(`left:${x - 6}px;top:${y - 6}px;width:12px;height:12px;border-radius:50%;background:${orange};box-shadow:0 0 0 2px #fff`);
      });
    },
    [boxEls, markEls, opts.lineLengths ?? [60, 130]] as const,
  );
}

/**
 * Lesson-style pointer: a white curved arrow ending at the left edge of the target, coming from below-left
 * (default) or curling down from above. `offsetY` sets where on the target it points (default: middle).
 */
export async function arrowTo(page: Page, target: Locator, opts: { from?: "below" | "above"; offsetY?: number } = {}) {
  const r = await target.boundingBox();
  if (!r) throw new Error("arrowTo: target is not visible");
  await page.evaluate(([r, from, offsetY]) => {
    const end = { x: r.x - 6, y: r.y + (offsetY ?? r.height / 2) };
    const curve =
      from === "above"
        ? (() => {
            const start = { x: end.x + 4, y: end.y - 75 };
            return `M${start.x},${start.y} C${start.x - 45},${start.y + 10} ${end.x - 45},${end.y} ${end.x},${end.y}`;
          })()
        : (() => {
            const start = { x: end.x - 120, y: end.y + 150 };
            return `M${start.x},${start.y} C${start.x - 10},${end.y + 30} ${end.x - 70},${end.y} ${end.x},${end.y}`;
          })();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-screenshot-tweak", "arrow");
    svg.setAttribute("style", "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647");
    svg.innerHTML =
      `<defs><marker id="st-head" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">` +
      `<path d="M0,0 L8,5 L0,10 Z" fill="#fff"/></marker></defs>` +
      `<path d="${curve}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" marker-end="url(#st-head)"/>`;
    document.body.appendChild(svg);
  }, [r, opts.from ?? "below", opts.offsetY ?? null] as const);
}

/**
 * Lesson-style annotation with several highlighted areas: dims the page except each area and outlines each
 * one in orange (the single-area spotlight() can't leave more than one hole in the overlay).
 * An area can be several locators; it then covers all of them.
 */
export async function spotlightAreas(page: Page, areas: (Locator | Locator[])[]) {
  // An area given as several locators covers all of them
  const rects = [];
  for (const area of areas) {
    const parts = [];
    for (const l of Array.isArray(area) ? area : [area]) {
      const r = await l.boundingBox();
      if (!r) throw new Error("spotlightAreas: an area is not visible");
      parts.push(r);
    }
    const x = Math.min(...parts.map((r) => r.x));
    const y = Math.min(...parts.map((r) => r.y));
    rects.push({
      x,
      y,
      width: Math.max(...parts.map((r) => r.x + r.width)) - x,
      height: Math.max(...parts.map((r) => r.y + r.height)) - y,
    });
  }
  await page.evaluate((rects) => {
    const pad = 4;
    const radius = 12;
    const boxes = rects.map((r) => ({ x: r.x - pad, y: r.y - pad, w: r.width + pad * 2, h: r.height + pad * 2 }));
    const round = (b: { x: number; y: number; w: number; h: number }) =>
      `M${b.x + radius},${b.y} h${b.w - 2 * radius} a${radius},${radius} 0 0 1 ${radius},${radius} v${b.h - 2 * radius} ` +
      `a${radius},${radius} 0 0 1 -${radius},${radius} h-${b.w - 2 * radius} a${radius},${radius} 0 0 1 -${radius},-${radius} ` +
      `v-${b.h - 2 * radius} a${radius},${radius} 0 0 1 ${radius},-${radius} Z`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-screenshot-tweak", "spotlight");
    svg.setAttribute("style", "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646");
    // Even-odd fill: the page-sized rectangle minus each area
    svg.innerHTML =
      `<path fill-rule="evenodd" fill="rgba(0,0,0,.5)" d="M0,0 H${innerWidth} V${innerHeight} H0 Z ${boxes.map(round).join(" ")}"/>` +
      boxes.map((b) => `<path d="${round(b)}" fill="none" stroke="#FCA700" stroke-width="3"/>`).join("");
    document.body.appendChild(svg);
  }, rects);
}

/**
 * Lesson-style hotspot markers without an outline: an orange dot on each item with a line running
 * "down" from below the label or "left" from the item's left edge. Use with spotlightAreas().
 */
export async function markers(page: Page, items: Locator, direction: "down" | "left", lengths: number[] = [150]) {
  const rects = (await items.evaluateAll((els) =>
    els.map((el) => {
      // Label text box, not the whole (possibly full-width) item
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, boxLeft: box.left, boxBottom: box.bottom };
    }),
  )).filter((r) => r.width > 0);
  await page.evaluate(
    ([rects, direction, lengths]) => {
      const orange = "#FCA700";
      const add = (css: string) => {
        const d = document.createElement("div");
        d.setAttribute("data-screenshot-tweak", "markers");
        d.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;${css}`;
        document.body.appendChild(d);
      };
      rects.forEach((r, i) => {
        const length = lengths[i % lengths.length];
        const { x, y } =
          direction === "down" ? { x: r.x + r.width / 2, y: r.boxBottom + 2 } : { x: r.x - 10, y: r.y + r.height / 2 };
        if (direction === "down") add(`left:${x - 1.5}px;top:${y}px;width:3px;height:${length}px;background:${orange}`);
        else add(`left:${x - length}px;top:${y - 1.5}px;width:${length}px;height:3px;background:${orange}`);
        add(`left:${x - 6}px;top:${y - 6}px;width:12px;height:12px;border-radius:50%;background:${orange};box-shadow:0 0 0 2px #fff`);
      });
    },
    [rects, direction, lengths] as const,
  );
}

/** Replaces the names in one table column with fake names, the same name for the same person. */
export async function fakeNames(page: Page, columnHeader: string, people = FAKE_PEOPLE) {
  await page.evaluate(([header, people]) => {
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th as HTMLElement).innerText.trim());
      const col = heads.findIndex((h) => h.startsWith(header));
      if (col < 0) continue;
      const names = new Map<string, string>();
      for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
        const cell = row.children[col] as HTMLElement | undefined;
        if (!cell) continue;
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const real = n.nodeValue?.trim();
          if (!real) continue;
          if (!names.has(real)) names.set(real, people[names.size % people.length]);
          n.nodeValue = names.get(real)!;
        }
      }
    }
  }, [columnHeader, people] as const);
}

/** A cell of fakeTable(): plain text, or HTML (an app icon, a lozenge) with `html: true`. */
export type FakeCell = string | { html: string };

/**
 * Display-only stand-in for a list the test site has no data for: replaces `replace` (usually the empty state) with a
 * table in the Atlassian admin style. `header: false` adds rows only, under a header the page already shows.
 */
export async function fakeTable(
  page: Page,
  replace: Locator,
  columns: { label: string; width?: string; align?: "left" | "right" }[],
  rows: FakeCell[][],
  opts: { header?: boolean } = {},
) {
  await replace.first().evaluate(
    (el, [columns, rows, header]) => {
      const cell = (c: FakeCell) => (typeof c === "string" ? c.replace(/[&<>]/g, (ch) => `&#${ch.charCodeAt(0)};`) : c.html);
      const td = "padding:12px 8px;font:inherit;font-size:14px;color:#292A2E;vertical-align:middle;border-bottom:1px solid #0B120E24;";
      const th = "padding:8px;font:inherit;font-size:14px;font-weight:600;color:#505258;text-align:left;border-bottom:2px solid #0B120E24;";
      const table = document.createElement("table");
      table.setAttribute("data-screenshot-tweak", "fake-table");
      table.style.cssText = "width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;";
      table.innerHTML =
        (header
          ? `<thead><tr>${columns.map((c) => `<th style="${th}width:${c.width ?? "auto"};text-align:${c.align ?? "left"}">${c.label}</th>`).join("")}</tr></thead>`
          : `<colgroup>${columns.map((c) => `<col style="width:${c.width ?? "auto"}">`).join("")}</colgroup>`) +
        `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td style="${td}text-align:${columns[i].align ?? "left"}">${cell(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      el.replaceWith(table);
    },
    [columns, rows, opts.header ?? true] as const,
  );
}

/** HTML for an Atlassian admin button (default or subtle), for fakeTable() rows. */
export const fakeButton = (label: string) =>
  `<span style="display:inline-flex;align-items:center;height:32px;padding:0 12px;border:1px solid #0B120E24;border-radius:4px;font-weight:500;color:#505258">${label}</span>`;

/** HTML for a status lozenge (e.g. INACTIVE), for fakeTable() rows. */
export const fakeLozenge = (label: string) =>
  `<span style="display:inline-block;padding:0 4px;border-radius:3px;background:#DDDEE1;color:#292A2E;font-size:11px;font-weight:700;line-height:16px;text-transform:uppercase">${label}</span>`;

/** Changes a "Showing 0 items" style count to the number of fake rows (the count may be split over several text nodes). */
export async function setCount(page: Page, locator: Locator, text: string) {
  await locator.first().evaluate((el, text) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Node[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach((n, i) => (n.nodeValue = i === 0 ? text : ""));
  }, text);
}
