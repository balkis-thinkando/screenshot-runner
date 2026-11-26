// Lesson:  AUC-1402 - Change the look and feel of a Confluence space
//          https://community.atlassian.com/learning/lesson/change-the-look-and-feel-of-a-confluence-space
// Image:   #2, section "Can you change a space's homepage?" (Space details with More details expanded, scrolled
//          down: the Home content field outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/2x8hjmw54628jb40xvf10v54ppk7lb5c.png
// Recipe:  public.screenshot_recipes where asset_id = '2x8hjmw54628jb40xvf10v54ppk7lb5c'
// Opens Space details of the SyncUp space, clicks "More details" (expands the form, saves nothing) and scrolls to
// Home content. The Home content drop-down is not opened. Names are fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, fakePeopleLinks, openSpaceDetails } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent");
const homeLabel = (page: Page) => main(page).getByText("Home content", { exact: true }).first();
const homeHelp = (page: Page) => main(page).getByText(/content that displays when users navigate to this space/).first();

runRecipe({
  file: "AUC-1402-2",
  assetId: "2x8hjmw54628jb40xvf10v54ppk7lb5c",
  title: "AUC-1402 #2 - Space details Home content",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceDetails(page, s);
    await main(page).getByRole("button", { name: /more details/i }).first().click();
    await homeLabel(page).waitFor({ timeout: 15_000 });
    // Expanding moves the focus into Categories; the lesson shows no field focused
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await homeHelp(page).evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1_000);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await dimAreas(page, [[homeLabel(page), homeHelp(page)]]);
    await page.mouse.move(1279, 799);
  },

  mask: (page) => [main(page).getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/).first()],

  async checks(page, c) {
    await c.check("Home content field with its help text", async () => {
      const l = await homeLabel(page).isVisible();
      const h = await homeHelp(page).isVisible();
      return { pass: l && h, detail: `Home content: ${l}; help text: ${h}` };
    });

    await c.check("Home content shows the space's home page", async () => {
      const box = await homeLabel(page).evaluate((l) => {
        let b = l.parentElement!;
        while (b.parentElement && !/content that displays/.test(b.innerText)) b = b.parentElement;
        return b.innerText.replace(/\s+/g, " ");
      });
      const value = box.replace(/Home content/, "").replace(/The content that displays.*$/, "").trim();
      return { pass: value.length > 0, detail: `Value: ${value || "empty"}` };
    });

    await c.check("More details fields: Categories, Description, then Collapse details", async () => {
      const missing = [];
      for (const f of ["Categories", "Description", "Collapse details"]) if (!(await main(page).getByText(f, { exact: true }).first().isVisible().catch(() => false))) missing.push(f);
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Save and Reset changes buttons", async () => {
      const save = await main(page).getByRole("button", { name: "Save" }).first().isVisible();
      const reset = await main(page).getByRole("button", { name: "Reset changes" }).first().isVisible();
      return { pass: save && reset, detail: `Save: ${save}; Reset changes: ${reset}` };
    });
  },
});
