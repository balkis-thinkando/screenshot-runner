import { Page } from "@playwright/test";
import { openSignedIn } from "./jira";
import { Settings } from "./supabase";

// Saved, switched-off automation flows in Platform Development (PLAT) for the AUC-12984 and AUC-12977 shots.
// Test data (17 Nov 2026, owner OK). They never run: both are Disabled.
export const PLAT_FLOWS = {
  // Version released -> Use agent "Release Notes Drafter" (test account's agent) -> Publish new page in Confluence
  releaseNotes: { id: "01a1e8ea-a29f-7b81-9050-fce293b6eb9c", name: "Create release notes" },
  // Scheduled (Wed 9:00) -> For: JQL -> Use agent "Readiness Checker" (Atlassian's) -> Edit work item fields
  readiness: { id: "01a1e8e6-341c-7843-9883-47c1fb94f6cc", name: "Run Readiness Checker for open work items" },
};

/** Opens a PLAT flow in the flow builder and waits for its steps and the Flow details panel. */
export async function openPlatFlow(page: Page, s: Settings, flow: { id: string; name: string }) {
  await openSignedIn(page, s, `/jira/software/c/projects/PLAT/settings/automate#/rule/${flow.id}`);
  // The Flow details panel's Name field holds the flow name once the builder has loaded
  // The automation app sometimes stays blank on first load: reload once
  const loaded = () => page.waitForFunction((name) => (document.querySelector('input[name="name"]') as HTMLInputElement | null)?.value === name, flow.name, { timeout: 40_000 });
  if (!(await loaded().then(() => true, () => false))) {
    await page.reload({ waitUntil: "commit" });
    await loaded();
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
  await page.mouse.move(1279, 799);
}

/** Flow step cards on the canvas (left of the Flow details panel), top to bottom. */
export async function flowSteps(page: Page) {
  return page.evaluate(() => {
    const panelX = (document.querySelector('input[name="name"]')?.getBoundingClientRect().x ?? 900) - 40;
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, [role=heading]"))
      .filter((h) => {
        const r = h.getBoundingClientRect();
        return r.width > 0 && r.x > 240 && r.x < panelX && r.y > 170;
      })
      .map((h) => (h.textContent ?? "").trim());
  });
}

/** Replaces text in the canvas only (display-only test-data labels). */
export async function relabel(page: Page, from: string, to: string) {
  await page.evaluate(
    ([from, to]) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.includes(from)) n.nodeValue = n.nodeValue.replaceAll(from, to);
    },
    [from, to] as const,
  );
}

/** Marks each step card on the canvas (the heading's widest ancestor that is still card-sized) and returns a
 *  locator for them, so the outline goes around whole cards. */
export async function markStepCards(page: Page) {
  await page.evaluate(() => {
    const panelX = (document.querySelector('input[name="name"]')?.getBoundingClientRect().x ?? 900) - 40;
    for (const h of Array.from(document.querySelectorAll("h1, h2, h3, h4, [role=heading]"))) {
      const r = h.getBoundingClientRect();
      if (!(r.width > 0 && r.x > 240 && r.x < panelX && r.y > 170)) continue;
      let card: Element = h;
      for (let a = h.parentElement; a; a = a.parentElement) {
        const b = a.getBoundingClientRect();
        if (b.width > 420 || b.height > 200) break;
        card = a;
      }
      card.setAttribute("data-screenshot-card", "");
    }
  });
  return page.locator("[data-screenshot-card]");
}
