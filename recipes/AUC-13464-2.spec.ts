// Lesson:  AUC-13464 - Configure how fields appear on work items in company-managed spaces
//          https://community.atlassian.com/learning/lesson/configure-how-fields-appear-on-work-items-in-company-managed-projects
// Image:   #2, section "Configure the layout for work items" (request type editor of "Request system access" in the IT
//          Operations service space, Request form tab, Fields panel on the right; the Request form and Work item view
//          tabs are outlined)
//          https://dam-cdn.atl.orangelogic.com/public/AT15XH4.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT15XH4'
// Opens Space settings > Request types of IT Operations (ITO) and the "Request system access" request type. The test
// account is not a space admin of ITO (Nov 2026: "This space isn't available"), so the recipe falls back to the closest
// real screen, the same editor in IT Support (ITS, "Request system access & software"), and the space check fails as
// "needs test data". Read only: nothing is dragged and Save changes is never clicked.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { spotlightAreas } from "../lib/tweaks";
import { openSignedIn } from "../lib/jira";
import { closeTours, havePermissions } from "../lib/b2-jira";
import { checkSidebar, failOnReauth, jadminTweaks } from "../lib/b3-jadmin";

const LESSON = { key: "ITO", name: "IT Operations" };
const FALLBACK = { key: "ITS", name: "IT Support" };
let shown = LESSON;

const rows = (page: Page) => page.locator("table tbody tr");
const unavailable = (page: Page) => page.getByText("This space isn't available");
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true }).first();
const fieldsPanel = (page: Page) => page.getByText("Search all fields", { exact: true }).first();

async function openRequestType(page: Page, s: import("../lib/supabase").Settings, key: string) {
  // Already signed in (navigate() opens the site through sign-in first)
  await page.goto(`${s.test_site}/jira/servicedesk/projects/${key}/settings/request-types`, { waitUntil: "commit" });
  await rows(page).first().or(unavailable(page)).first().waitFor({ timeout: 90_000 }).catch(() => {});
  await failOnReauth(page);
  if (!(await rows(page).first().isVisible().catch(() => false))) return false;
  const link = page.getByRole("link", { name: /^Request system access/ }).first();
  if (!(await link.isVisible().catch(() => false))) return false;
  await link.click();
  await tab(page, "Request form").waitFor({ timeout: 60_000 });
  await fieldsPanel(page).waitFor({ timeout: 30_000 }).catch(() => {});
  return true;
}

runRecipe({
  file: "AUC-13464-2",
  assetId: "AT15XH4",
  title: "AUC-13464 #2 - Request type editor, Request form tab",
  product: "jira",

  async navigate(page, s) {
    // Ask Jira first whether the test account administers the lesson's space (saves a slow page load when it does not)
    await openSignedIn(page, s, "/jira/your-work");
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    const perms = await havePermissions(page, LESSON.key, ["ADMINISTER_PROJECTS"]).catch(() => ({ ADMINISTER_PROJECTS: null }));
    shown = perms.ADMINISTER_PROJECTS ? LESSON : FALLBACK;
    if (!(await openRequestType(page, s, shown.key))) {
      if (shown === FALLBACK || !(await openRequestType(page, s, (shown = FALLBACK).key)))
        throw new Error(`Request type editor did not open in ${shown.key}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await closeTours(page);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jadminTweaks(page, s);
    await spotlightAreas(page, [[tab(page, "Request form"), tab(page, "Work item view")]]);
  },

  async checks(page, c) {
    await c.check("Space settings of the IT Operations service space", async () => {
      const t = await page.locator("body").innerText();
      const ok = t.includes("Space settings") && t.includes("Service space");
      return {
        pass: ok && shown === LESSON,
        detail: shown === LESSON ? `Space settings: ${ok}` : `Needs test data: the test account is not a space admin of ${LESSON.key}; showing ${FALLBACK.name} instead`,
      };
    });

    await checkSidebar(c, page, "Sidebar: Request management > Request types > Service requests (selected), Forms, Workflows, SLAs, Fields, Screens",
      ["Request management", "Request types", "Service requests", "Incidents", "Problems", "Changes", "Forms", "Workflows", "SLAs", "Customer satisfaction", "Fields", "Screens"], "Service requests");

    await c.check("Back to request types, Restrictions, Manage workflow", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Back to request types", "Restrictions", "Manage workflow"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Tabs: Request form (selected), Work item view, Workflow statuses", async () => {
      const form = await tab(page, "Request form").getAttribute("aria-selected").catch(() => null);
      const view = await tab(page, "Work item view").isVisible().catch(() => false);
      const wf = await tab(page, "Workflow statuses").isVisible().catch(() => false);
      return { pass: form === "true" && view && wf, detail: `Request form selected: ${form}; Work item view: ${view}; Workflow statuses: ${wf}` };
    });

    await c.check("Request type 'Request system access' with description and field list", async () => {
      const t = await page.locator("body").innerText();
      const title = /Request system access/.test(t);
      const missing = ["Request type description", "Instructions", "Access Level", "Description", "Summary", "Affected services"].filter((w) => !t.includes(w));
      return { pass: title && !missing.length, detail: `Title: ${title}${missing.length ? `; missing fields: ${missing.join(", ")}` : ""}` };
    });

    await c.check("Fields panel: Search all fields, Date and time fields", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Fields", "Search all fields", "Use fields from any space on your site", "Date and time fields"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Footer: Give feedback, View in Portal, Discard, Save changes", async () => {
      const t = await page.locator("body").innerText();
      const missing = ["Give feedback", "View in Portal", "Discard", "Save changes"].filter((w) => !t.includes(w));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
  },
});
