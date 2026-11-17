// Lesson:  AUC-404 - Enhance pages in Confluence
//          https://community.atlassian.com/learning/lesson/enhance-pages-in-confluence
// Image:   #2, section "Enhance page headers" (editor, the Emoji button above the title and its emoji picker outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/x4245220542720vduw1e1avg22a302j1.png
// Recipe:  public.screenshot_recipes where asset_id = 'x4245220542720vduw1e1avg22a302j1'
// Opens the editor of the SyncUp "Engineering onboarding guide", hovers the title and opens the title emoji picker.
// No emoji is picked, nothing is typed or published (owner OK for opening the editor). The lesson page has a header
// image; this one has none, so the row above the title also shows "Header image".

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { fakeByline, hideBackToTop, hideTooltips, hoverTitle, openEditor, outlineBoxes, titleRow } from "../lib/b2-editor";

const emojiButton = (page: Page) => page.locator("#emoji-popup-button");
const search = (page: Page) => page.locator('[data-testid="emoji-picker-search"]');

const picker = (page: Page) => page.locator('[data-testid="emoji-picker"]').first();
const pickerBox = async (page: Page) => (await picker(page).boundingBox())!;

runRecipe({
  file: "AUC-404-2",
  assetId: "x4245220542720vduw1e1avg22a302j1",
  title: "AUC-404 #2 - Title emoji picker in the editor",
  product: "confluence",

  async navigate(page, s) {
    await openEditor(page, s);
    await hoverTitle(page);
    await emojiButton(page).click();
    await search(page).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[5]);
    await fakeByline(page, FAKE_PEOPLE[0]);
    await anonymize(page, "KC", FAKE_PEOPLE);
    await hideBackToTop(page);
    await hideTooltips(page);
    await outlineBoxes(page, [(await emojiButton(page).boundingBox())!, await pickerBox(page)]);
    await page.mouse.move(1279, 799);
  },

  async checks(page, c) {
    await c.check("Row above the title: Emoji, Status, Suggest title", async () => {
      const text = (await titleRow(page).innerText()).replace(/\s+/g, " ");
      const missing = ["Emoji", "Status", "Suggest title"].filter((t) => !text.includes(t));
      return { pass: !missing.length, detail: `Row: ${text}` };
    });

    await c.check("Emoji picker: category tabs and a Search box", async () => {
      const tabs = (await picker(page).locator('[data-testid^="category-selector-"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))).filter((t) => t && !t.startsWith("Choose"));
      const placeholder = await search(page).getAttribute("placeholder");
      return { pass: tabs.length >= 8 && /Search/.test(placeholder ?? ""), detail: `Tabs: ${tabs.join(", ")}; search placeholder: ${placeholder}` };
    });

    await c.check("Skin tone selector next to the search box", async () => {
      const v = await picker(page).locator('[data-testid="tone-preview"]').first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "Present" : "Missing" };
    });

    await c.check("'Add your own emoji' in the picker", async () => {
      const own = await page.getByText("Add your own emoji").first().isVisible().catch(() => false);
      const add = await page.getByRole("button", { name: "Add emoji", exact: true }).first().isVisible().catch(() => false);
      return { pass: own, detail: own ? "Present" : add ? "Now an 'Add emoji' button at the bottom of the picker" : "Missing" };
    });

    await c.check("Emoji grid with a category heading", async () => {
      const n = await page.locator('[data-testid^="image-emoji-"]:visible').count();
      const heading = await page.locator('[data-testid="render-emoji-picker-categorty-heading"]:visible').first().innerText().catch(() => "");
      return { pass: n >= 20 && !!heading.trim(), detail: `${n} emojis shown; first heading: ${heading.trim()}` };
    });
  },
});
