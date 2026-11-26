// Lesson:  AUC-671 - Configure SLAs to manage service quality goals
//          https://community.atlassian.com/learning/lesson/master-jira-service-management-sla-configuration
// Image:   #1, section "Define time zones and working hours with SLA calendars" (IT Support space settings > SLAs with the Calendars dialog open (This service project / Other calendars, Sample 9-5 Calendar: Timezone, Work week); the calendar card outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/154e10hi47g5ka115rjwj0f54r52ds3v
// Recipe:  public.screenshot_recipes where asset_id = '154e10hi47g5ka115rjwj0f54r52ds3v'
// Opens IT Support (ITS) space settings > SLAs and the Calendars dialog. Nothing is added or edited.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { checkControl, checkHeading, checkTexts, columns, jsmTweaks, mainArea, openAndWait, openItsQueue, queueMask, settle, sidebarItem, textOf, ITS, ITS_SLA_ITEM, outline } from "../lib/b3-jsm";
import { spotlight, spotlightAreas, markers } from "../lib/tweaks";

const dialog = (page: Page) => page.getByRole("dialog").filter({ hasText: /Calendars/ }).first();
const card = (page: Page) => dialog(page).getByText(/9-5 Calendar/).first().locator("xpath=ancestor::*[.//*[contains(., 'Work week')]][1]");

runRecipe({
  file: "AUC-671-1",
  assetId: "154e10hi47g5ka115rjwj0f54r52ds3v",
  title: "AUC-671 #1 - SLA calendars dialog",
  product: "jira",

  async navigate(page, s) {
    await openAndWait(page, s, "/jira/servicedesk/projects/ITS/settings/sla", (p) => p.getByText("Time to resolution"));
    await page.getByRole("button", { name: /calendar/i }).first().click();
    await dialog(page).waitFor({ timeout: 30_000 });
    // Expand the first calendar when it is collapsed
    // Expand the first calendar (the chevron at the end of its row; the "..." menu next to it is left closed)
    if (!(await dialog(page).getByText("Work week").first().isVisible().catch(() => false))) {
      const row = dialog(page).getByText(/9-5 Calendar/).first().locator("xpath=ancestor::*[count(.//button)>=2][1]");
      await row.getByRole("button").last().click().catch(() => {});
      await dialog(page).getByText("Work week").first().waitFor({ timeout: 15_000 }).catch(() => {});
    }
    await page.waitForTimeout(2_000);
    await page.mouse.move(1279, 799);
  },

  async tweak(page, s) {
    await jsmTweaks(page, s);
    if (await card(page).isVisible().catch(() => false)) await outline(page, card(page));
  },

  async checks(page, c) {
    await checkHeading(c, "Dialog 'Calendars' with Add calendar", page, "Calendars", dialog(page));
    await checkTexts(c, "Tabs: This service project / Other calendars (or This service space)", page, ["Other calendars"], dialog(page));
    await checkTexts(c, "Sample 9-5 Calendar: Timezone, Work week, Monday to Friday 09:00 to 17:00", page, ["9-5 Calendar", "Timezone", "Work week", "Monday", "Friday", "09:00", "17:00"], dialog(page));
    await checkControl(c, "'Add calendar' button", page, /Add calendar/, dialog(page));
  },
});
