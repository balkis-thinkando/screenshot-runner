import { Locator, Page } from "@playwright/test";

// Display-only usage fakes for Atlassian Administration (Overview, Usage > Meters, Rovo credits).
// The test org has almost no usage, so its charts and bars look empty. These helpers redraw the page's own
// chart SVG and numbers with a plausible scenario. Nothing is saved to the site.
// Each helper only fakes when the real value looks empty (under EMPTY_SHARE of its allowance), so real
// usage shows as is once the site has some.

/** Real usage under this share of the allowance counts as "empty" (the bars and charts read as 0%). */
export const EMPTY_SHARE = 0.05;

/** Rovo credits scenario, shared by AUC-330-2, AUC-16040-3 and AUC-16040-4 so the numbers agree. */
export const ROVO = {
  /** Allowance when a page doesn't show one (the Overview card). Pages that show it use their own. */
  defaultAllowance: 202_000,
  /** Share of the allowance used so far this period: Meters "Allowance used" and the Rovo credits page. */
  usedShare: 0.53,
  /** Typical month as a share of the allowance: "Monthly average" and the Overview daily pace. */
  monthlyShare: 0.78,
};

/** Other meters on Usage > Meters: share of the allowance used, or a count where there is no allowance. */
export const OTHER_METERS: Record<string, { share?: number; count?: number }> = {
  "Assets objects": { share: 0.08 },
  "Automation steps": { share: 0.36 },
  "Customer Service Management AI": { count: 128 },
  "Indexed objects": { count: 1_284 },
  "Rovo Dev credits": { count: 36 },
};

/** Open requests for app access on the Overview card, by app. */
export const ACCESS_REQUESTS: Record<string, number> = { Jira: 2, Confluence: 1, "Jira Service Management": 1, "Jira Product Discovery": 0 };

export const rovoUsed = (allowance: number) => Math.round((allowance * ROVO.usedShare) / 10) * 10;
export const rovoMonthlyAverage = (allowance: number) => Math.round((allowance * ROVO.monthlyShare) / 10) * 10;
export const fmt = (n: number) => n.toLocaleString("en-US");
/** Chart style for large numbers: 201352 -> 201.35K */
export const fmtK = (n: number) => (n < 1000 ? String(n) : `${+(n / 1000).toFixed(2)}K`);

/** Relative activity on a day: weekdays busy, weekends quiet, a stable bit of day-to-day variation. */
export function dayWeight(d: Date) {
  const dow = d.getUTCDay();
  const base = dow === 0 || dow === 6 ? 0.35 : 1.15;
  const r = Math.sin(Math.floor(d.getTime() / 86_400_000) * 12.9898) * 43758.5453;
  return base * (0.8 + 0.4 * (r - Math.floor(r)));
}

/** Daily values for `days` days from `start`, adding up to exactly `total`. */
export function dailySeries(start: Date, days: number, total: number) {
  const w = Array.from({ length: days }, (_, i) => dayWeight(new Date(start.getTime() + i * 86_400_000)));
  const sum = w.reduce((a, b) => a + b, 0);
  const v = w.map((x) => Math.round((x / sum) * total));
  if (days) v[days - 1] += total - v.reduce((a, b) => a + b, 0);
  return v;
}

const cumulative = (v: number[]) => v.reduce<number[]>((acc, x, i) => [...acc, (acc[i - 1] ?? 0) + x], []);
const toNumber = (t: string) => {
  const m = t.replace(/,/g, "").match(/([\d.]+)\s*([KM])?/);
  return m ? parseFloat(m[1]) * (m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : 1) : NaN;
};

/**
 * Overview > Rovo credits usage card (last 7 days: daily and cumulative lines). Same daily pace as the Rovo
 * credits page. Returns false when the card already shows real usage.
 */
export async function fakeOverviewRovo(page: Page) {
  const card = page.locator('[data-testid="overview-ai-credit"]').first();
  const shown = toNumber(await card.locator('h2[data-testid="avc-chart-summary-value"]').first().innerText());
  const weekPace = (ROVO.defaultAllowance * ROVO.monthlyShare * 7) / 30;
  if (shown >= weekPace * EMPTY_SHARE) return false;

  const today = new Date(new Date().toISOString().slice(0, 10));
  const start = new Date(today.getTime() - 6 * 86_400_000);
  const meanWeight = (5 * 1.15 + 2 * 0.35) / 7;
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return Math.round((((ROVO.defaultAllowance * ROVO.monthlyShare) / 30) * dayWeight(d)) / meanWeight);
  });
  const cum = cumulative(daily);
  // The chart re-renders whenever its layout changes (wider y labels, one-line dates), which resets what was
  // drawn. Every step below is idempotent, so it repeats until a second later everything is still in place.
  for (let pass = 0; pass < 5; pass++) {
    await card.evaluate(
      (el, [total]) => {
        const fmtK = (n: number) => (n < 1000 ? String(n) : `${+(n / 1000).toFixed(2)}K`);
        el.querySelector('h2[data-testid="avc-chart-summary-value"]')!.textContent = total.toLocaleString("en-US");
        // The page sizes each date label to ~16px, so "Nov 12" wraps to "N / ov / 12" (also without the fake).
        // Let each label take its own width on one line; translateX(-50%) keeps it centred on its tick.
        for (const d of Array.from(el.querySelectorAll('[data-axis-type="axis-bottom"] [aria-hidden="true"]')) as HTMLElement[]) {
          d.style.width = "max-content";
          d.style.whiteSpace = "nowrap";
        }
        // Linear y-axis: keep the tick positions, relabel them to a round maximum above the cumulative total
        const ticks = Array.from(el.querySelectorAll('[data-axis-type="axis-left"] span')) as HTMLElement[];
        const topOf = (s: HTMLElement) => parseFloat((s.closest('[style*="top: calc"]') as HTMLElement).style.top.match(/calc\(([\d.]+)px/)![1]);
        const pos = ticks.map(topOf);
        const h = Math.max(...pos);
        const steps = ticks.length - 1;
        const raw = total / steps;
        const mag = 10 ** Math.floor(Math.log10(raw));
        const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
        const max = step * steps;
        ticks.forEach((t, i) => (t.textContent = fmtK(Math.round(((h - pos[i]) / h) * max))));
      },
      [cum[6]] as const,
    );
    await redrawLines(page, card, [["categorical-1", daily], ["categorical-2", cum]]);
    await page.waitForTimeout(1_000);
    const settled = await card.evaluate((el) => {
      const ticks = Array.from(el.querySelectorAll('[data-axis-type="axis-left"] span')).map((t) => t.textContent!.trim());
      const dates = Array.from(el.querySelectorAll('[data-axis-type="axis-bottom"] [aria-hidden="true"]')) as HTMLElement[];
      const line = el.querySelector("svg path[stroke]");
      return (
        ticks.every((t) => t === "0" || t.endsWith("K")) &&
        dates.every((d) => d.style.whiteSpace === "nowrap") &&
        !!line && line.getAttribute("d") === line.getAttribute("data-fake-d")
      );
    });
    if (settled) break;
  }
  return true;
}

/** Overview > Open requests for app access card (bar per app). Only when it shows 0 requests. */
export async function fakeOverviewRequests(page: Page) {
  const card = page.locator('[data-element="layout"]').filter({ has: page.getByText("Open requests for app access", { exact: true }) }).last();
  if (!(await card.count())) return false;
  const shown = toNumber(await card.locator('h2[data-testid="avc-chart-summary-value"]').first().innerText());
  if (shown !== 0) return false;
  await card.evaluate((el, values) => {
    el.querySelector('h2[data-testid="avc-chart-summary-value"]')!.textContent = String(Object.values(values).reduce((a, b) => a + b, 0));
    const h = parseFloat(el.querySelector('rect[data-testid="tooltip-emitter"]')!.getAttribute("height")!);
    const max = Math.max(1, ...Object.values(values));
    const y = (v: number) => h - (v / max) * h;
    // Bars: same x position and width, new height, rounded top
    for (const bar of Array.from(el.querySelectorAll("svg path[aria-label]"))) {
      const app = bar.getAttribute("aria-label")!.match(/x: (.*), y:/)?.[1] ?? "";
      const v = values[app] ?? 0;
      const xs = [...bar.getAttribute("d")!.matchAll(/[ML]([\d.]+)/g)].map((m) => parseFloat(m[1]));
      const [x1, x2] = [Math.min(...xs), Math.max(...xs)];
      const top = y(v);
      const r = v ? 3 : 0;
      bar.setAttribute("d", `M${x1} ${h}L${x1} ${top + r}A${r} ${r} 0 0 1 ${x1 + r} ${top}L${x2 - r} ${top}A${r} ${r} 0 0 1 ${x2} ${top + r}L${x2} ${h}Z`);
      bar.setAttribute("aria-label", `, x: ${app}, y: ${v}`);
    }
    // Y-axis: one label, tick mark and grid line per whole number, cloned from the single "0" the page draws
    const label = el.querySelector('[data-axis-type="axis-left"] [style*="top: calc"]') as HTMLElement;
    const oldTop = label.style.top.match(/calc\(([\d.]+)px/)![1];
    const grid = Array.from(el.querySelectorAll(`[style*="top: calc(${oldTop}px)"]`)).filter((e) => !e.closest('[data-axis-type="axis-left"]')) as HTMLElement[];
    for (let v = 0; v <= max; v++) {
      const l = label.cloneNode(true) as HTMLElement;
      l.style.top = `calc(${y(v)}px - 0.5rem)`;
      l.querySelector("span")!.textContent = String(v);
      label.parentElement!.appendChild(l);
      for (const g of grid) {
        const c = g.cloneNode(true) as HTMLElement;
        c.style.top = `calc(${y(v)}px)`;
        g.parentElement!.appendChild(c);
      }
    }
    label.remove();
    grid.forEach((g) => g.remove());
  }, ACCESS_REQUESTS);
  return true;
}

/** Usage > Meters table: Allowance used bars and Usage values. Each row is only faked when it looks empty. */
export async function fakeMetersTable(page: Page) {
  const shares: Record<string, { share?: number; count?: number }> = { ...OTHER_METERS, "Rovo credits": { share: ROVO.usedShare } };
  return page.locator("table").first().evaluate(
    (table, [shares, emptyShare]) => {
      const faked: string[] = [];
      const pill = (w: number) => `<rect x="0" y="2.8" width="${w}" height="8.4" rx="4" ry="4"`;
      for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
        const cells = tr.querySelectorAll("td");
        const name = (cells[0]?.textContent ?? "").trim();
        const key = Object.keys(shares).find((k) => name.startsWith(k));
        if (!key) continue;
        const usage = cells[2]?.querySelector("span") ?? cells[2];
        if (!usage) continue;
        const text = usage.textContent!.trim();
        const m = text.match(/^([\d,]+)(?: of ([\d,]+))? (.+)$/);
        if (!m) continue;
        const used = parseInt(m[1].replace(/,/g, ""), 10);
        const allowance = m[2] ? parseInt(m[2].replace(/,/g, ""), 10) : 0;
        const { share, count } = shares[key];
        if (allowance && share) {
          if (used >= allowance * emptyShare) continue;
          // Rovo credits: same rounding as rovoUsed() so the Rovo credits page shows the same figure
          const fake = Math.round((allowance * share) / 10) * 10;
          usage.textContent = `${fake.toLocaleString("en-US")} of ${m[2]} ${m[3]}`;
          const stack = cells[1]?.querySelector('[data-testid="progress-bar-stack"]');
          const svg = stack?.querySelector("svg");
          if (stack && svg) {
            const w = parseFloat((stack.querySelector('[data-element="layout"]') as HTMLElement).style.width) || 150;
            svg.innerHTML =
              `${pill(w)} fill="var(--ds-background-accent-gray-subtlest-hovered, #DDDEE1)"/>` + `${pill(Math.max(8, w * share))} fill="var(--ds-chart-categorical-1, #357DE8)"/>`;
            const pct = Array.from(stack.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && /%/.test(n.nodeValue ?? ""));
            if (pct) pct.nodeValue = `${Math.round(share * 100)}%`;
          }
          faked.push(key);
        } else if (!allowance && count && used === 0) {
          usage.textContent = `${count.toLocaleString("en-US")} ${m[3]}`;
          faked.push(key);
        }
      }
      return faked;
    },
    [shares, EMPTY_SHARE] as const,
  );
}

/**
 * Meters > Rovo credits > Usage tab: Monthly average, Allowance used (percentage, legend, bar), Credits this
 * period, and the Daily / Cumulative credits lines (from the period start to today). Only when usage looks empty.
 */
export async function fakeRovoCreditsDetail(page: Page) {
  const read = await page.evaluate(() => {
    const leafAfter = (heading: string, re: RegExp) => {
      const h = Array.from(document.querySelectorAll("h2")).find((e) => e.textContent!.trim() === heading);
      let box: Element | null = h ?? null;
      for (let i = 0; box && i < 6; i++, box = box.parentElement) {
        const leaf = Array.from(box.querySelectorAll("*")).find((e) => !e.children.length && re.test(e.textContent!.trim()));
        if (leaf) return leaf.textContent!.trim();
      }
      return "";
    };
    const report = document.querySelector('[data-testid="platform-usage-insights-report"]');
    const daily = report?.querySelector('svg path[stroke*="categorical-3"]');
    const range = Array.from(document.querySelectorAll("button, span, div")).map((e) => e.textContent!.trim()).find((t) => /^\w{3} \d{1,2}, \d{4} to /.test(t));
    return {
      allowance: leafAfter("Allowance", /^[\d,]+ credits$/),
      period: leafAfter("Credits this period", /^[\d,]+$/),
      points: daily ? (daily.getAttribute("d")!.match(/[ML]/g) ?? []).length : 0,
      start: range?.split(" to ")[0] ?? "",
    };
  });
  const allowance = toNumber(read.allowance) || ROVO.defaultAllowance;
  const period = toNumber(read.period);
  if (!(period < allowance * EMPTY_SHARE)) return null;

  const used = rovoUsed(allowance);
  const start = read.start ? new Date(`${read.start} UTC`) : new Date();
  const daily = dailySeries(start, read.points, used);
  const fake = {
    used,
    pct: `${Math.round((used / allowance) * 100)}%`,
    usedK: fmtK(used),
    remainingK: fmtK(allowance - used),
    share: used / allowance,
    monthly: `${fmt(rovoMonthlyAverage(allowance))} credits`,
    daily,
    cum: cumulative(daily),
  };
  await page.evaluate((f) => {
    const setLeaf = (heading: string, re: RegExp, text: string) => {
      const h = Array.from(document.querySelectorAll("h2")).find((e) => e.textContent!.trim() === heading);
      let box: Element | null = h ?? null;
      for (let i = 0; box && i < 6; i++, box = box.parentElement) {
        const leaf = Array.from(box.querySelectorAll("*")).find((e) => !e.children.length && re.test(e.textContent!.trim()));
        if (leaf) return void (leaf.textContent = text);
      }
    };
    setLeaf("Monthly average", /^[\d,]+ credits$/, f.monthly);
    setLeaf("Allowance used", /^\d+%$/, f.pct);
    setLeaf("Credits this period", /^[\d,]+$/, f.used.toLocaleString("en-US"));

    // Allowance used legend and bar
    for (const o of Array.from(document.querySelectorAll('[role="option"][aria-label^="Allowance used "], [role="option"][aria-label^="Allowance remaining "]'))) {
      const label = o.getAttribute("aria-label")!.startsWith("Allowance used") ? `Allowance used ${f.usedK}` : `Allowance remaining ${f.remainingK}`;
      o.setAttribute("aria-label", label);
      const text = Array.from(o.querySelectorAll("div")).find((d) => !d.children.length && /^Allowance /.test(d.textContent!.trim()));
      if (text) text.textContent = label;
    }
    const usedBar = document.querySelector('path[aria-label^="Allowance used"]');
    const restBar = document.querySelector('path[aria-label^="Allowance remaining"]');
    const svg = usedBar?.closest("svg");
    const w = parseFloat(svg?.querySelector('rect[data-testid="tooltip-emitter"]')?.getAttribute("width") ?? "0");
    if (usedBar && restBar && w) {
      const x = +(w * f.share).toFixed(2);
      usedBar.setAttribute("d", `M1 0.2L${x} 0.2L${x} 16.2L1 16.2Z`);
      restBar.setAttribute("d", `M${x + 1} 0.2L${w - 2} 0.2A2 2 0 0 1 ${w} 2.2L${w} 14.2A2 2 0 0 1 ${w - 2} 16.2L${x + 1} 16.2Z`);
    }

  }, fake);
  const report = page.locator('[data-testid="platform-usage-insights-report"]').first();
  if (await report.count()) await redrawLines(page, report, [["categorical-3", daily], ["categorical-1", fake.cum]]);
  return { used, pct: fake.pct, monthly: fake.monthly };
}

/**
 * Redraws the lines of an Atlassian chart (stroke colour token -> one value per point) in the page's own SVG.
 * The y scale comes from the axis labels (linear, or log when they go 1, 10, 100...); x stays the page's own.
 * Drawn twice, a second apart: the chart re-renders when the numbers around it change width.
 */
async function redrawLines(page: Page, root: Locator, series: [string, number[]][]) {
  for (let pass = 0; pass < 2; pass++) {
    await page.waitForTimeout(1_000);
    await root.evaluate((el, series) => {
      const num = (t: string) => {
        const m = t.trim().match(/^([\d.]+)([KM])?$/);
        return m ? parseFloat(m[1]) * (m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : 1) : NaN;
      };
      const ticks = Array.from(el.querySelectorAll('[data-axis-type="axis-left"] span'))
        .map((s) => ({ v: num(s.textContent!), y: parseFloat(((s.closest('[style*="top: calc"]') as HTMLElement)?.style.top.match(/calc\(([\d.]+)px/) ?? [])[1]) }))
        .filter((t) => !isNaN(t.v) && !isNaN(t.y))
        .sort((a, b) => a.v - b.v);
      if (ticks.length < 2) return;
      const lo = ticks[0];
      const hi = ticks[ticks.length - 1];
      const log = lo.v > 0 && ticks.every((t, i) => !i || Math.abs(t.v / ticks[i - 1].v - 10) < 0.01);
      const y = (v: number) =>
        +(log
          ? lo.y - ((Math.log10(Math.max(v, lo.v)) - Math.log10(lo.v)) / (Math.log10(hi.v) - Math.log10(lo.v))) * (lo.y - hi.y)
          : lo.y - ((v - lo.v) / (hi.v - lo.v)) * (lo.y - hi.y)
        ).toFixed(3);
      for (const [color, values] of series) {
        const line = el.querySelector(`svg path[stroke*="${color}"]:not([stroke-dasharray])`);
        if (!line) continue;
        const xs = [...line.getAttribute("d")!.matchAll(/[ML]([\d.]+),/g)].map((m) => parseFloat(m[1]));
        const d = xs.map((x, i) => `${i ? "L" : "M"}${x},${y(values[i] ?? 0)}`).join("");
        line.setAttribute("d", d);
        line.setAttribute("data-fake-d", d); // lets callers see whether a re-render replaced the line
        for (const c of Array.from(el.querySelectorAll(`svg circle[fill*="${color}"]`))) {
          const cx = parseFloat(c.getAttribute("cx")!);
          const i = xs.reduce((best, x, j) => (Math.abs(x - cx) < Math.abs(xs[best] - cx) ? j : best), 0);
          c.setAttribute("cy", String(y(values[i] ?? 0)));
        }
      }
    }, series);
  }
}
