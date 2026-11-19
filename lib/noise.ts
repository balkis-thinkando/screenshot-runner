import { Page } from "@playwright/test";

// Pop-ups that are never what a lesson shows, hidden display-only in every recipe (owner feedback SHOT-104,
// Nov 2026). Nothing is clicked or dismissed on the site, so no preference changes; the next page load shows
// them again. Dialogs and menus a recipe opens on purpose are NOT touched: only the kinds below.
//  - banners and messages known by their text (some only show on the Linux CI runner, e.g. the whiteboard
//    performance banner, so they never appear in local test runs)
//  - Atlassian flags (toasts at the bottom left) and onboarding spotlights / tours, found by the layer their
//    portal sits on (Atlaskit z-index 600 for flags, 700 for spotlights)
// A recipe that needs one of these in the shot sets keepPopups: true.

/** Texts of banners and messages to hide (case-insensitive, matched anywhere in a short text block). */
export const NOISE_TEXTS = [
  /browser settings are slowing down your whiteboard/i,
  /turn on hardware acceleration/i,
];

/** Atlaskit layers (portal z-index) that only hold flags and onboarding spotlights. */
const NOISE_LAYERS = [600, 700];

/** Hides noise in the page and in every frame (whiteboards render in an iframe). Returns what was hidden. */
export async function hideNoise(page: Page): Promise<string[]> {
  const hidden: string[] = [];
  for (const frame of page.frames()) {
    const found = await frame
      .evaluate(
        ([texts, layers]) => {
          const res = (texts as string[]).map((t) => new RegExp(t, "i"));
          const out: string[] = [];
          const ours = (e: Element) => !!e.closest("[data-screenshot-tweak], [data-screenshot-area], [data-screenshot-mask]");
          const hide = (e: HTMLElement, why: string) => {
            if (e.dataset.screenshotNoise) return;
            e.dataset.screenshotNoise = why;
            e.style.setProperty("display", "none", "important");
            const t = (e.innerText || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.includes("@"))[0] ?? "";
            out.push(`${why}: ${t.slice(0, 80)}`);
          };
          // Flags and spotlights: whole Atlaskit portals on those layers
          for (const p of Array.from(document.querySelectorAll<HTMLElement>(".atlaskit-portal"))) {
            const z = Number(getComputedStyle(p).zIndex || p.style.zIndex);
            if ((layers as number[]).includes(z) && !ours(p) && (p.innerText || "").trim()) hide(p, z === 600 ? "flag" : "spotlight");
          }
          // Banners by text: the largest banner-sized box around the text (not taller than 120px)
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
            if (el.children.length > 4 || ours(el)) continue;
            const t = (el.innerText || "").trim();
            if (!t || t.length > 300 || !res.some((re) => re.test(t))) continue;
            let box: HTMLElement = el;
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              const r = a.getBoundingClientRect();
              if (r.height > 120 || (a.innerText || "").length > 400) break;
              box = a;
            }
            hide(box, "banner");
          }
          return out;
        },
        [NOISE_TEXTS.map((r) => r.source), NOISE_LAYERS] as const,
      )
      .catch(() => [] as string[]);
    hidden.push(...found.map((f) => (frame === page.mainFrame() ? f : `frame ${f}`)));
  }
  return hidden;
}
