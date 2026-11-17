// Lesson:  AUC-669 - Set up requests and queues
//          https://community.atlassian.com/learning/lesson/set-up-requests-and-queues
// Image:   #1, section "Configure request types to track customer needs" (Space settings > Request types of the
//          Commercial Legal Service Desk service space; nothing outlined)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12RU.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12RU'
// Opens Space settings > Request types of Commercial Legal Service Desk (CLSD, exists on the site). The test account
// is not a space admin of CLSD (Nov 2026: "This space isn't available"), so the recipe then falls back to the closest
// real screen, the same page in IT Support (ITS), where it is admin, and the space check fails as "needs test data".
// Read only: no request type is created or edited.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { Settings } from "../lib/supabase";
import { openSignedIn } from "../lib/jira";
import { jiraPeopleTweaks } from "../lib/b2-jira";

const LESSON_SPACE = { key: "CLSD", name: "Commercial Legal Service Desk" };
const FALLBACK_SPACE = { key: "ITS", name: "IT Support" };
const rows = (page: Page) => page.locator("table tbody tr");
const unavailable = (page: Page) => page.getByText("This space isn't available");
let shown = LESSON_SPACE;

async function openRequestTypes(page: Page, s: Settings, key: string) {
  await openSignedIn(page, s, `/jira/servicedesk/projects/${key}/settings/request-types`);
  await Promise.race([rows(page).first().waitFor({ timeout: 60_000 }), unavailable(page).first().waitFor({ timeout: 60_000 })]).catch(() => {});
  return rows(page).first().isVisible();
}

runRecipe({
  file: "AUC-669-1",
  assetId: "AT12RU",
  title: "AUC-669 #1 - Request types in space settings",
  product: "jira",

  async navigate(page, s) {
    shown = LESSON_SPACE;
    if (!(await openRequestTypes(page, s, LESSON_SPACE.key))) {
      shown = FALLBACK_SPACE;
      if (!(await openRequestTypes(page, s, FALLBACK_SPACE.key))) throw new Error("Request types did not load in the fallback space either");
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jiraPeopleTweaks(page, s);
  },

  async checks(page, c) {
    await c.check("Space settings of the Commercial Legal Service Desk service space", async () => {
      const text = await page.locator("body").innerText();
      const settings = text.includes("Space settings") && text.includes("Service space");
      const lesson = shown === LESSON_SPACE;
      return {
        pass: settings && lesson,
        detail: lesson
          ? `Space settings: ${settings}`
          : `Needs test data: the test account is not a space admin of ${LESSON_SPACE.key}; showing ${FALLBACK_SPACE.name} instead`,
      };
    });

    await c.check("Page heading 'Request types' with 'Create request type' button", async () => {
      const h1 = (await page.locator("h1").first().innerText().catch(() => "")).trim();
      const create = await page.getByRole("button", { name: /Create request type/ }).first().isVisible().catch(() => false);
      return { pass: h1 === "Request types" && create, detail: `Heading: "${h1}"; Create request type: ${create}` };
    });

    await c.check("Filters: Find request type, Work types, Request type groups, Portal groups, View settings", async () => {
      const search = await page.getByPlaceholder("Find request type").isVisible().catch(() => false);
      const text = await page.locator("main, [role=main]").first().innerText().catch(() => page.locator("body").innerText());
      const missing = ["Work types", "Request type groups", "Portal groups", "View settings"].filter((t) => !text.includes(t));
      return { pass: search && !missing.length, detail: `Search: ${search}; missing: ${missing.join(", ") || "none"}` };
    });

    await c.check("Columns: Request type, Work type, Workflow, Portal", async () => {
      const cols = (await page.locator("table thead th").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
      const missing = ["Request type", "Work type", "Workflow"].filter((w) => !cols.includes(w));
      const portal = cols.some((c) => c.startsWith("Por"));
      return { pass: !missing.length && portal, detail: `Columns: ${cols.join(", ")}` };
    });

    await c.check("Request types listed", async () => {
      const n = await rows(page).count();
      return { pass: n > 0, detail: `${n} rows (lesson: 10+)` };
    });

    await c.check("Sidebar: Request management > Request types, Forms, Workflows, Queues, SLAs, Customer satisfaction, Work item types, Fields, Screens", async () => {
      const text = await page.locator("body").innerText();
      const missing = ["Request management", "Request types", "Forms", "Workflows", "Queues", "SLAs", "Customer satisfaction", "Work item types", "Fields", "Screens", "Automation", "Playbooks", "Channels & self service"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
