// Lesson:  AUC-426 - Organize your work in Jira Service Management
//          https://community.atlassian.com/learning/lesson/how-to-organize-work-in-jira-service-management
// Image:   #4, section "Monitor your SLAs" (Incident work item view (Login issue with Web Server); the SLAs panel with Time to resolution and Time to first response outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/jqmc7v715q0670ir8cj6tsr2526u5353
// Recipe:  public.screenshot_recipes where asset_id = 'jqmc7v715q0670ir8cj6tsr2526u5353'
// Opens ITS request ITS-6256, which has running SLAs (stand-in for the lesson's IT Operations incident; it is an access
// request, not an incident). Outlines the SLAs panel. Nothing is edited. People become fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const slaPanel = (page: Page) => page.getByRole("heading", { name: "SLAs" }).or(page.getByText("SLAs", { exact: true })).first().locator("xpath=ancestor::*[.//*[contains(., 'Time to')]][1]");

runRecipe({
  file: "AUC-426-4",
  assetId: "jqmc7v715q0670ir8cj6tsr2526u5353",
  title: "AUC-426 #4 - SLAs panel on an incident",
  product: "jira",

  navigate: (page, s) => openAndWait(page, s, `/jira/servicedesk/projects/ITS/queues/custom/1/${ITS_SLA_ITEM}`, (p) => p.getByText("Time to resolution")),

  async tweak(page, s) {
    await jsmTweaks(page, s);
    await outline(page, slaPanel(page));
  },

  mask: (page) => [slaPanel(page)],

  async checks(page, c) {
    await c.check("SLAs panel with Time to resolution and Time to first response", async () => {
      const text = await textOf(slaPanel(page));
      const missing = ["SLAs", "Time to resolution", "Time to first response"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });
    await c.check("SLA goals 'within Nh'", async () => {
      const text = await textOf(slaPanel(page));
      const pass = /within \d+h/.test(text);
      return { pass, detail: pass ? "Present" : `Panel: "${text.replace(/\s+/g, " ").slice(0, 120)}"` };
    });
    await c.check("Details panel: Request Type, Priority, Assignee, Reporter, Labels", async () => {
      const text = await textOf(page.locator("body"));
      const missing = ["Details", "Priority", "Assignee", "Reporter", "Labels"].filter((t) => !text.includes(t));
      if (!/request type/i.test(text)) missing.push("Request Type");
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present (below the SLAs panel)" };
    });
    await checkTexts(c, "Request details: 'raised this request', View request in portal, Description", page, ["raised this request", "View request in portal", "Description"]);
    await checkTexts(c, "Activity: Add internal note / Reply to customer", page, ["Add internal note", "Reply to customer"]);
  },
});
