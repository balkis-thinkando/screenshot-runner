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
