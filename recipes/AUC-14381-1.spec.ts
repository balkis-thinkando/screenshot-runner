// Lesson:  AUC-14381 - Create, share, and refine diagrams with Rovo
//          https://community.atlassian.com/learning/lesson/create-share-and-refine-diagrams-with-rovo
// Image:   #1, Rovo's whiteboard preview after a diagram prompt ("Preview - Only visible to you", Add to Confluence)
//          https://dam-cdn.atl.orangelogic.com/CDNLink/AT12G803.png
// Recipe:  public.screenshot_recipes where asset_id = 'AT12G803'
// Sends the lesson's prompt to Rovo on a Confluence page (Rovo prompts: owner OK, 13 Nov 2026). Rovo saves the
// diagram as a private draft whiteboard only the test account can see; "Add to Confluence" is never clicked.
// Each run adds a chat and a private draft for the test account. The diagram and answer are written by AI and
// differ on every run, so they are masked and only the structure is checked.

import { Page, test } from "@playwright/test";
import sharp from "sharp";
import { runRecipe } from "../lib/recipe";
import { openConfluencePage, ROVO_PAGE } from "../lib/confluence";
import { chatPanel, keepAgentIcons, newRovoChat, sendPrompt } from "../lib/rovo";
import { anonymize, fakeProfileNames, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";

// The lesson's prompt, plus the process itself: the test site has no Velocity Squad pages, and without them Rovo
// asks a question instead of drawing
const PROMPT =
  "Create a flow chart diagram to illustrate the Release management process for the Velocity Squad team, making sure to clarify when the QA team can start testing. " +
  "The steps are: Development, Code review, QA testing in staging, Approval, Production. QA starts testing once code review passes and the release branch is in staging. " +
  "Draw it now without asking questions.";
const preview = (page: Page) => page.getByRole("dialog").filter({ hasText: /Only visible to you/i }).last();

/** Waits (up to 90 s) until the upper 75% of the preview board is no longer blank: at least 0.5% non-white pixels. */
async function waitForDiagram(page: Page) {
  const board = preview(page).locator("iframe").first();
  await board.waitFor({ timeout: 60_000 });
  // While "Loading your preview" shows, the page behind it shows through and would count as a drawing
  await preview(page).getByText(/Loading your preview/i).waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const box = await board.boundingBox();
    if (box) {
      const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height * 0.75 } });
      const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
      let ink = 0;
      for (const v of data) if (v < 230) ink++;
      if (ink / (info.width * info.height) > 0.005) {
        await page.waitForTimeout(2_000); // let the last shapes and connectors finish drawing
        return;
      }
    }
    await page.waitForTimeout(2_000);
  }
  // Still blank: capture anyway, the checks and the AI review will report it
}

runRecipe({
  file: "AUC-14381-1",
  assetId: "AT12G803",
  title: "AUC-14381 #1 - Rovo diagram preview",
  product: "confluence",

  async navigate(page, s) {
    test.setTimeout(420_000); // Rovo takes one to three minutes to draw the diagram
    await openConfluencePage(page, s, ROVO_PAGE.space, ROVO_PAGE.id);
    await newRovoChat(page);
    await sendPrompt(page, PROMPT);
    // The answer ends with a whiteboard card and its Preview button; drawing can outlast the answer text
    const open = page.locator(chatPanel).getByText("Preview", { exact: true }).last();
    await open.waitFor({ timeout: 180_000 });
    await open.click();
    await preview(page).getByRole("button", { name: "Add to Confluence" }).waitFor({ timeout: 60_000 });
    await page.mouse.move(1279, 799);
    // The whiteboard preview draws after the dialog opens, sometimes a minute later: a fixed wait captured a
    // blank board (18 Nov 2026). Wait until the preview's canvas area has a drawing in it.
    await waitForDiagram(page);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await keepAgentIcons(page);
    await fakeSignedInUser(page, FAKE_PEOPLE[0]);
    await fakeProfileNames(page);
    await anonymize(page, "AW", FAKE_PEOPLE);
  },

  // The diagram, its title and Rovo's answer are AI-written
  mask: (page) => [preview(page).locator("iframe, canvas").first(), preview(page).locator('[data-testid*="title"], h1, h2').first()],

  async checks(page, c) {
    await c.check("Preview dialog: whiteboard title with 'Preview - Only visible to you'", async () => {
      const tag = await preview(page).getByText(/Preview\s*•\s*Only visible to you/i).first().isVisible();
      return { pass: tag, detail: tag ? "Present" : "Missing" };
    });

    await c.check("'Add to Confluence' button and a close button", async () => {
      const add = await preview(page).getByRole("button", { name: "Add to Confluence" }).isVisible();
      const close = await preview(page).getByRole("button", { name: /Close/ }).first().isVisible();
      return { pass: add && close, detail: `Add to Confluence: ${add}; close: ${close}` };
    });

    await c.check("Whiteboard preview on the left (not a permission or lock page)", async () => {
      // The preview is an iframe: look inside every frame
      let locked = false;
      for (const f of page.frames()) {
        if (await f.getByText(/This space is locked|don't have permission to access this space/i).first().isVisible().catch(() => false)) locked = true;
      }
      return { pass: !locked, detail: locked ? "Preview shows 'This space is locked'" : "Preview shown" };
    });

    await c.check("Rovo chat on the right with the prompt and Rovo's steps", async () => {
      const prompt = await preview(page).getByText(PROMPT).first().isVisible();
      const steps = await preview(page).getByText(/^(Steps \d+\/\d+|Completed \d+ steps?)$/).first().isVisible();
      return { pass: prompt && steps, detail: `Prompt: ${prompt}; steps line: ${steps}` };
    });

    await c.check("Prompt box 'Describe what you want to know or do next'", async () => {
      const box = await preview(page).getByText(/Describe what you want to know or do next/).first().isVisible();
      return { pass: box, detail: box ? "Same placeholder" : "Placeholder changed" };
    });
  },
});
