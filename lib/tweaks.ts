import { Page } from "@playwright/test";

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

/** Replaces email addresses and profile pictures with neutral placeholders. */
export async function anonymize(page: Page, initials = "AU") {
  await page.evaluate((initials) => {
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
    // Profile pictures: Atlassian serves them from .../avatar
    document.querySelectorAll<HTMLImageElement>('img[src*="/avatar"], img[src*="gravatar"]').forEach((img) => {
      const { width, height } = img.getBoundingClientRect();
      const span = document.createElement("span");
      span.textContent = initials;
      span.style.cssText =
        `display:inline-flex;align-items:center;justify-content:center;width:${width || 24}px;` +
        `height:${height || 24}px;border-radius:50%;background:#1D2125;color:#fff;font:600 10px sans-serif`;
      img.replaceWith(span);
    });
  }, initials);
}

/** Hides banners, onboarding messages or pop-ups that start with any of the given texts. */
export async function hideMessages(page: Page, startsWith: string[]) {
  await page.evaluate((starts) => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const text = el.innerText?.trim() ?? "";
      if (text.length > 600 || !starts.some((s) => text.startsWith(s))) continue;
      const box = el.closest<HTMLElement>('[role="dialog"],section,[data-testid]') ?? el;
      box.style.display = "none";
    }
  }, startsWith);
}

/**
 * Lesson-style annotation: dims the page except the given items, outlines them in orange and
 * (optionally) adds a hotspot marker to each item: a dot after its label and a line running right.
 * Matches the labelled-graphic images (overlay 50% black, orange #FCA700).
 */
export async function spotlight(page: Page, itemsSelector: string, opts: { markers?: boolean; lineLengths?: number[] } = {}) {
  await page.evaluate(
    ([sel, markers, lineLengths]) => {
      const orange = "#FCA700";
      const items = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetParent && el.innerText.trim());
      if (!items.length) throw new Error(`spotlight: nothing matches ${sel}`);
      const rects = items.map((el) => el.getBoundingClientRect());
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
      if (!markers) return;
      items.forEach((el, i) => {
        // Right edge of the label text (first text node), not of the item or badges such as "New"
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue?.trim() ? 1 : 3) });
        const label = walker.nextNode() ?? el;
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const y = text.top + text.height / 2;
        const x = text.right + 10;
        const length = lineLengths[i % lineLengths.length];
        add(`left:${x}px;top:${y - 1.5}px;width:${box.right + length - x}px;height:3px;background:${orange}`);
        add(`left:${x - 6}px;top:${y - 6}px;width:12px;height:12px;border-radius:50%;background:${orange};box-shadow:0 0 0 2px #fff`);
      });
    },
    [itemsSelector, opts.markers ?? true, opts.lineLengths ?? [60, 130]] as const,
  );
}
