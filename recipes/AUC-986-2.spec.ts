// Lesson:  AUC-986 - What is service request management?
//          https://community.atlassian.com/learning/lesson/what-is-service-request-management
// Image:   #2 (help center home: "How can we help you today?", search box, six featured portals, Show more portals,
//          Recently used request forms; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/d8862st277p572r0278103w1a0mtv4h2.png
// Recipe:  public.screenshot_recipes where asset_id = 'd8862st277p572r0278103w1a0mtv4h2'
// Opens the site's help center home as the test account. Nothing is searched or requested.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { openSignedIn } from "../lib/jira";
import { anonymize, renameOrg } from "../lib/tweaks";

const heading = (page: Page) => page.locator("h1").first();
const LESSON_PORTALS = ["Service Desk", "Facilities Services", "Human Resources", "Operations", "Marketing Services", "Engineering Support"];

runRecipe({
  file: "AUC-986-2",
  assetId: "d8862st277p572r0278103w1a0mtv4h2",
  title: "AUC-986 #2 - Help center home with portals",
  product: "jira",

  async navigate(page, s) {
    await openSignedIn(page, s, "/servicedesk/customer/portals");
    await page.getByText("Featured portals").first().waitFor({ timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
    // The profile button shows the test account's initials
    await page.locator('[data-testid^="user-avatar-container"]').evaluateAll((els) =>
      els.forEach((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/^[A-Z]{1,3}$/.test(n.nodeValue?.trim() ?? "")) n.nodeValue = "KC";
      }),
    );
  },

  async checks(page, c) {
    await c.check("Heading 'How can we help you today?'", async () => {
      const h = (await heading(page).innerText()).trim();
      return { pass: h === "How can we help you today?", detail: h === "How can we help you today?" ? "Present" : `Heading is "${h.slice(0, 80)}" (the help center title is site-customisable: check site settings before treating it as a UI change)` };
    });

    await c.check("Search box 'Search for information'", async () => {
      const v = await page.getByPlaceholder(/Search for information/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("Featured portals: Service Desk, Facilities Services, Human Resources, Operations, Marketing Services, Engineering Support", async () => {
      const text = await page.locator("body").innerText();
      const featured = text.includes("Featured portals");
      const missing = LESSON_PORTALS.filter((p) => !text.includes(p));
      // A portal the test account cannot open (Nov 2026: Engineering Support) is not listed: test data, not a UI change
      return { pass: featured && !missing.length, detail: `Featured portals heading: ${featured}; missing: ${missing.join(", ") || "none"}${missing.length ? " (test data: portals the test account cannot open are not shown)" : ""}` };
    });

    await c.check("'Show more portals' button", async () => {
      const b = page.getByRole("button", { name: /Show more portals/ }).first();
      const v = await b.isVisible().catch(() => false);
      return { pass: v, detail: v ? `Present ("${(await b.innerText()).trim()}"; lesson: 6 more)` : "Missing" };
    });

    await c.check("Help center name in the header ('Help Center')", async () => {
      const t = (await page.locator("header, [role=banner]").first().innerText().catch(() => "")).split("\n")[0].trim();
      return { pass: /Help Center/.test(t), detail: `Header: "${t.slice(0, 60)}"` };
    });

    await c.check("No announcement banner (the lesson has none)", async () => {
      const b = await page.locator('[data-testid="announcement-banner-header"]').isVisible().catch(() => false);
      return { pass: !b, detail: b ? "Site data: an announcement banner is shown above the portals" : "None" };
    });
  },
});
