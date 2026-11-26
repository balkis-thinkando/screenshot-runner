// Lesson:  AUC-422 - Start navigating Jira Service Management
//          https://community.atlassian.com/learning/lesson/start-navigating-jira-service-management
// Image:   #2, section "What are work items and requests?" (Help center request view: breadcrumbs Help Center / Service Desk / key, title, 'raised this on', Description, Activity with comment box, Status, Escalate / Resolve / Cancel, Request type, Shared with)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/qu166v85rdcgbhv0hb770yyddxj8w80d
// Recipe:  public.screenshot_recipes where asset_id = 'qu166v85rdcgbhv0hb770yyddxj8w80d'
// Opens ITS request ITS-6256 in the help center (the test account is an ITS agent, so it can view it there; it raised
// no request itself). Nothing is commented, shared or transitioned. People become fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

runRecipe({
  file: "AUC-422-2",
  assetId: "qu166v85rdcgbhv0hb770yyddxj8w80d",
  title: "AUC-422 #2 - Help center request view",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, `/servicedesk/customer/portal/${ITS.portalId}/${ITS_SLA_ITEM}`, (p) => p.getByText(/raised this on/).or(p.getByText(/Not Found|can't find|don't have permission/i)));
  },

  tweak: (page, s) => jsmTweaks(page, s),

  mask: (page) => [page.getByText(/raised this on/)],

  async checks(page, c) {
    await c.check("Request view reached (title, 'raised this on')", async () => {
      const v = await page.getByText(/raised this on/).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Needs test data: the test account cannot open an ITS request in the help center" };
    });
    await checkTexts(c, "Breadcrumbs Help Center / portal / request key", page, ["Help Center", ITS_SLA_ITEM]);
    await c.check("Details toggle (Show/Hide details) and Activity", async () => {
      const text = await textOf(page.locator("body"));
      const pass = /(Show|Hide) details/.test(text) && text.includes("Activity");
      return { pass, detail: pass ? "Present" : "Missing" };
    });
    await c.check("Comment box 'Add a comment'", async () => {
      const v = await page.getByPlaceholder(/Add a comment/).or(page.getByText("Add a comment")).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });
    await checkTexts(c, "Side panel: Status, Request type, Shared with, Share", page, ["Status", "Request type", "Shared with", "Share"]);
    await c.check("Status actions (lesson: Escalate, Resolve this issue, Cancel request)", async () => {
      const text = await textOf(page.locator("body"));
      const found = ["Escalate", "Resolve this issue", "Cancel request"].filter((t) => text.includes(t));
      return { pass: found.length > 0, detail: `Shown: ${found.join(", ") || "none"}${found.length ? "" : " (test data: the request is waiting for approval, which offers no customer actions)"}` };
    });
  },
});
