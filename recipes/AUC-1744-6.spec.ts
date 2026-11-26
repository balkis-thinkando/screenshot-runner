// Lesson:  AUC-1744 - Grant and remove access to Confluence spaces
//          https://community.atlassian.com/learning/lesson/grant-and-remove-access-to-confluence-spaces
// Image:   #6, section "Make a space public with anonymous access" (Confluence administration > Global
//          permissions, Anonymous access tab: the Anonymous users row outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT14QEL.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT14QEL'
// Opens Global permissions and clicks the Anonymous access tab (a tab, nothing is edited). Whether anonymous
// users may use Confluence is a site setting: the lesson shows it allowed (green tick); the check reports the
// site's state.

import { Page } from "@playwright/test";
import { Blocked, runRecipe } from "../lib/recipe";
import { Settings } from "../lib/supabase";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg, spotlight } from "../lib/tweaks";
import { closePopups, itemTexts, missingFrom, openWikiPath } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent");
const tab = (page: Page) => main(page).getByRole("tab", { name: "Anonymous access" });
const panel = (page: Page) => main(page).getByRole("tabpanel").first();
const row = (page: Page) => panel(page).locator("tr, [role=row]").filter({ hasText: "Anonymous users" }).first();
const table = (page: Page) => panel(page).locator("table, [role=table], [role=grid]").first();

/** Confluence's generic error page ("Something went wrong."), shown on a temporary server error. */
const errorPage = (page: Page) => page.getByRole("heading", { name: /Something went wrong/ }).first();

/** Opens Global permissions, trying again when Confluence shows its temporary error page. */
async function openGlobalPermissions(page: Page, s: Settings) {
  for (let attempt = 1; ; attempt++) {
    try {
      await openWikiPath(page, s, "/admin/permissions/global", tab(page), "Global permissions");
      return;
    } catch (e) {
      if (e instanceof Blocked) throw e;
      const outage = await errorPage(page).isVisible().catch(() => false);
      if (!outage) throw e;
      if (attempt >= 3) throw new Error("Global permissions did not load: Confluence showed 'Something went wrong.'");
      await page.waitForTimeout(10_000);
    }
  }
}

runRecipe({
  file: "AUC-1744-6",
  assetId: "AT14QEL",
  title: "AUC-1744 #6 - Global permissions anonymous access",
  product: "confluence",

  async navigate(page, s) {
    await openGlobalPermissions(page, s);
    await closePopups(page);
    await tab(page).click();
    await row(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await spotlight(page, table(page), { markers: false });
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Global permissions heading and Manage groups button", async () => {
      const h = await main(page).locator("h1, h2").filter({ hasText: "Global permissions" }).first().isVisible();
      const mg = await main(page).getByRole("button", { name: /Manage groups/ }).or(main(page).getByRole("link", { name: /Manage groups/ })).first().isVisible();
      return { pass: h && mg, detail: `Heading: ${h}; Manage groups: ${mg}` };
    });

    await c.check("Tabs: User groups, Guests, Public links, Anonymous access, JSM access, Apps", async () => {
      const tabs = await itemTexts(main(page).getByRole("tab"));
      const missing = missingFrom(tabs, ["User groups", "Guests", "Public links", "Anonymous access", "JSM access", "Apps"]);
      return { pass: !missing.length, detail: `Tabs: ${tabs.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Anonymous access explanation and Edit button", async () => {
      const text = await panel(page).getByText(/By enabling anonymous access/).first().isVisible().catch(() => false);
      const edit = await panel(page).getByRole("button", { name: /^Edit/ }).first().isVisible().catch(() => false);
      return { pass: text && edit, detail: `Explanation: ${text}; Edit: ${edit}` };
    });

    await c.check("Columns: Users, Use Confluence, View User Profile", async () => {
      const heads = await itemTexts(table(page).locator("th, [role=columnheader]"));
      const missing = missingFrom(heads, ["Users", "Use Confluence", "View User Profile"]);
      return { pass: !missing.length, detail: `Columns: ${heads.join(", ")}${missing.length ? `. Missing: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Anonymous users row (Anyone on the internet)", async () => {
      const t = (await row(page).innerText()).replace(/\s+/g, " ").trim();
      return { pass: /Anyone on the internet/.test(t), detail: t.slice(0, 120) };
    });

    await c.check("Anonymous users may use Confluence (green tick, as in the lesson)", async () => {
      const labels = await row(page).locator("[aria-label], [role=img]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? "").filter(Boolean));
      const allowed = labels.some((l) => /allowed|granted|enabled|yes|has permission|check/i.test(l) && !/not|no /i.test(l));
      return { pass: allowed, detail: `Icons: ${labels.join(", ") || "none labelled"}${allowed ? "" : " (site setting: anonymous access is off on the test site)"}` };
    });
  },
});
