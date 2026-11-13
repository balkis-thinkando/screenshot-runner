import { Page } from "@playwright/test";
import { Checks } from "./recipe";

// Shared steps for Rovo Chat, the side panel opened with "Ask Rovo" in Jira and Confluence.

// Jira and Confluence put the panel in different containers
export const chatPanel = ':is([data-testid="page-layout.aside"], [data-testid="right-sidebar-panel"])';
export const chatHeader = '[data-testid="rovo-chat-header-container"]';

/** Opens the Rovo Chat panel. The panel remembers whether it was open, so only click when it is closed. */
export async function openRovoChat(page: Page) {
  const header = page.locator(chatHeader);
  const ask = page.getByRole("button", { name: "Ask Rovo", exact: true });
  await header.or(ask).first().waitFor({ timeout: 60_000 });
  // A panel left open last time is restored a few seconds after the page loads; clicking before that would close it
  await header.waitFor({ timeout: 8_000 }).catch(() => {});
  for (let i = 0; i < 2 && !(await header.isVisible()); i++) {
    await ask.click();
    await header.waitFor({ timeout: 15_000 }).catch(() => {});
  }
  await header.waitFor({ timeout: 5_000 });
  // Close the chat menu if it was left open
  const closeMenu = page.locator('[data-testid="rovo-chat-sidenav-close-button"]');
  if (await closeMenu.isVisible()) await closeMenu.click();
  await page.waitForTimeout(1_500);
}

/** Opens the menu of the chat panel (New chat, Agents, Chats). */
export async function openRovoMenu(page: Page) {
  const close = page.locator('[data-testid="rovo-chat-sidenav-close-button"]');
  if (!(await close.isVisible())) await page.locator('[data-testid="rovo-chat-header-menu-button"]').click();
  await close.waitFor();
  await page.getByRole("link", { name: "View all agents" }).waitFor();
  await page.waitForTimeout(1_500); // the menu slides in
}

/** Rovo greets the signed-in user by first name ("How can I help, ...?"): show a fake one. */
export async function fakeGreeting(page: Page, firstName: string) {
  await page.evaluate((name) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue && /^How can I help, .+\?$/.test(n.nodeValue.trim())) n.nodeValue = `How can I help, ${name}?`;
    }
  }, firstName);
}

export const agentsDialog = '[data-testid="modal-dialog"]';

/** Opens "Agents for every team" from the chat menu (View all agents). */
export async function openAgentsDialog(page: Page) {
  await openRovoMenu(page);
  await page.getByRole("link", { name: "View all agents" }).click();
  await page.locator(agentsDialog).getByRole("tab").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
}

/** Starts a chat with an agent from the agents dialog (All agents, searched by name). Nothing is sent to the agent. */
export async function chatWithAgent(page: Page, name: string) {
  await openAgentsDialog(page);
  const dialog = page.locator(agentsDialog);
  await dialog.getByRole("tab", { name: "All agents" }).click();
  // The search box may first show as an icon
  const box = dialog.locator('input[aria-label="Search agents"]:visible, input[type="search"]:visible').first();
  if (!(await box.isVisible())) await dialog.locator('input[aria-label="Search agents"]').first().locator("xpath=..").click({ force: true });
  await box.fill(name);
  const card = dialog.locator('button[aria-label]').filter({ has: page.getByText(name, { exact: true }) }).first()
    .or(dialog.getByRole("button", { name, exact: true })).first();
  await card.waitFor({ timeout: 30_000 });
  await card.click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.locator('[data-testid="agent-title-pressable"]', { hasText: name }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
}

/** Marks Rovo agent icons (served from avatar URLs) so anonymize() leaves them alone. */
export async function keepAgentIcons(page: Page) {
  await page.evaluate(() => {
    const scopes = document.querySelectorAll('[data-testid="modal-dialog"] [data-testid^="browse-agent--"], [data-testid="page-layout.aside"] a, [data-testid="rovo-chat-header-container"], [data-testid="page-layout.aside"] h1, [data-testid="page-layout.aside"] img');
    scopes.forEach((el) => el.setAttribute("data-screenshot-keep", ""));
  });
}

/** Conversation starters of the agent shown in the chat panel. */
export const starters = (page: Page) =>
  page.locator(`${chatPanel} button[aria-label]:not([aria-label^="Change agent"])`).filter({ hasText: /\w/ }).filter({ hasNotText: /^(Add|Auto|Submit|Close|Menu|New chat|Start dictation|\+\d+)$/ });

export async function boardReady(page: Page) {
  await page.getByRole("heading", { name: /Employee Onboarding/ }).or(page.getByText("Employee Onboarding").first()).first().waitFor({ timeout: 60_000 });
  await page.getByText(/^To Do/i).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2_000);
}

/** Checks shared by the two Work Item Planner shots (AUC-497-2, AUC-498-3). */
export async function agentChecks(page: Page, c: Checks) {
  await c.check("Chat header: Work Item Planner selected, with back, menu, new chat, expand, more and close", async () => {
    const header = page.locator(chatHeader);
    const name = (await header.innerText()).includes("Work Item Planner");
    const buttons = await header.getByRole("button").count();
    return { pass: name && buttons >= 5, detail: `Agent name: ${name ? "shown" : "missing"}; ${buttons} header buttons` };
  });

  await c.check("Agent intro: icon, name and description", async () => {
    const title = await page.locator(chatPanel).getByText("Work Item Planner", { exact: true }).nth(1).isVisible().catch(() => false);
    const desc = await page.locator(chatPanel).getByText(/Turn large workloads/).first().isVisible();
    return { pass: title && desc, detail: `Title: ${title}; description: ${desc}` };
  });

  await c.check("Three conversation starters", async () => {
    const texts = (await starters(page).allInnerTexts()).map((t) => t.trim());
    return { pass: texts.length === 3, detail: `${texts.length}: ${texts.join(" | ")}` };
  });

  await c.check("Context chip shows the board (Employee Onboarding | Board)", async () => {
    const ctx = await page.locator(chatPanel).getByText(/Context:?/).first().isVisible();
    const board = await page.locator(chatPanel).getByText(/Employee Onboarding/).first().isVisible();
    return { pass: ctx && board, detail: `Context label: ${ctx}; board name: ${board}` };
  });

  await c.check("Prompt box: 'Write a prompt, @someone, or use / for actions'", async () => {
    const box = await page.locator(chatPanel).getByText(/Write a prompt, @someone, or use \/ for actions/).first().isVisible();
    return { pass: box, detail: box ? "Same placeholder" : "Placeholder changed" };
  });
}


/** Starts a new chat with Rovo itself (not an agent left selected by an earlier run). */
export async function newRovoChat(page: Page) {
  await openRovoChat(page);
  // Disabled when the chat is already empty
  const fresh = page.locator('[data-testid="rovo-chat-header-new-chat-button"]');
  if (await fresh.isEnabled()) {
    await fresh.click();
    await page.waitForTimeout(1_500);
  }
  const agent = page.locator('[data-testid="agent-title-pressable"]');
  if ((await agent.innerText()).trim() !== "Rovo") {
    await agent.click();
    await page.getByRole("menuitem", { name: /^Rovo$/ }).or(page.getByRole("option", { name: /^Rovo$/ })).first().click();
    await page.waitForTimeout(1_500);
  }
}

/** Sends a prompt to Rovo and waits until the answer has finished (the feedback buttons appear). */
export async function sendPrompt(page: Page, prompt: string) {
  await page.locator(`${chatPanel} [contenteditable="true"]`).first().click();
  await page.keyboard.type(prompt);
  await page.keyboard.press("Enter");
  await page.locator(chatPanel).getByText(prompt, { exact: true }).first().waitFor({ timeout: 30_000 });
  // Rovo shows a Stop button while it answers
  const stop = page.locator(chatPanel).getByRole("button", { name: /^Stop/ });
  await stop.waitFor({ timeout: 15_000 }).catch(() => {});
  await stop.waitFor({ state: "hidden", timeout: 150_000 });
  await page.waitForTimeout(2_000);
}

/** AI-written parts of the chat (the answer text), masked when comparing captures: they differ on every run. */
export const answerText = (page: Page) => page.locator(`${chatPanel} :is(p, li, h1, h2, h3, h4, table, pre)`).filter({ hasNotText: /^(Uses AI|Describe what you want|Ask, @mention)/ });
