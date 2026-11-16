import { Page } from "@playwright/test";
import { Blocked } from "./recipe";
import { Settings } from "./supabase";

// Rovo Studio (studio.atlassian.com) for the AUC-498 custom agent shots.

/** Test data: a custom agent owned by the test account on the test site (created 16 Nov 2026, owner OK).
 *  It mirrors the lesson's agent: same name, description, instructions and conversation starters. */
export const DACI_AGENT = {
  name: "DACI Document Assistant",
  // ari:cloud:rovo::agent/activation/<activation>/<agent>
  id: "616a6ecb-d951-42ee-a8ee-063312f056e3/c0b71163-edeb-41ac-8b5d-727c378ee5b4",
  starters: [
    "Help me create a DACI document for an upcoming decision",
    "Who should be the Driver vs Approver in my DACI?",
    "Create a DACI page in Confluence for my project",
  ],
};

/** The agent's title in the page header (a hidden copy of the name exists for screen readers). */
export const agentHeading = (page: Page) => page.locator("h1, [role=heading]").filter({ hasText: DACI_AGENT.name }).first();

async function cloudId(page: Page, s: Settings) {
  const res = await page.request.get(`${s.test_site}/_edge/tenant_info`);
  return (await res.json()).cloudId as string;
}

/** Opens the test agent in Studio: its details page, or its draft (the editable view, nothing is saved). */
export async function openAgentInStudio(page: Page, s: Settings, view: "details" | "draft") {
  const ari = encodeURIComponent(`ari:cloud:rovo::agent/activation/${DACI_AGENT.id}`);
  const url = `https://studio.atlassian.com/s/${await cloudId(page, s)}/agents/${ari}/${view === "draft" ? "v/draft/details" : "details"}`;
  await page.goto(`https://id.atlassian.com/login?continue=${encodeURIComponent(url)}`, { waitUntil: "commit" });
  await page.waitForURL((u) => u.hostname === "studio.atlassian.com", { timeout: 60_000, waitUntil: "commit" }).catch(() => {});
  if (new URL(page.url()).hostname !== "studio.atlassian.com") throw new Blocked("Session expired: stopped at Atlassian sign-in");
  await agentHeading(page).waitFor({ timeout: 60_000 }).catch(() => {});
  if (!(await agentHeading(page).isVisible())) {
    const missing = await page.getByText(/not found|couldn't find|could not find/i).first().isVisible().catch(() => false);
    if (missing) throw new Blocked(`Test data missing: agent "${DACI_AGENT.name}" not found in Studio`);
    throw new Error("The agent page did not load");
  }
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
}

/** Closes Studio's left navigation (the lesson shows the page without it). */
export async function collapseStudioSidebar(page: Page) {
  const collapse = page.getByRole("button", { name: "Collapse sidebar", exact: true });
  if (await collapse.isVisible()) {
    await collapse.click();
    await page.waitForTimeout(1_000);
  }
}

/** Labels of Studio's left navigation (the lesson's layout: For you, Insights, Skills, Apps, Agents...). */
export async function studioNavLabels(page: Page) {
  const nav = page.locator('nav[aria-label="Sidebar"]');
  // Never return the profile button's label (it is the account email)
  return (await nav.locator("a, button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => t && !t.includes("@"));
}

/** Studio serves agent icons from avatar URLs: mark every picture except the profile button's so anonymize()
 *  keeps the agent icons (the only person pictured on these pages is the signed-in user). */
export async function keepStudioAgentIcons(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      if (!img.closest('nav[aria-label="Actions"]')) img.setAttribute("data-screenshot-keep", "");
    });
  });
}
