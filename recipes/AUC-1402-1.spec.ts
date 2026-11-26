// Lesson:  AUC-1402 - Change the look and feel of a Confluence space
//          https://community.atlassian.com/learning/lesson/change-the-look-and-feel-of-a-confluence-space
// Image:   #1, section "How to upload a new logo" (Space settings > Space details: the space icon hovered, with
//          its edit overlay and "Edit space icon" tooltip; outlined)
//          https://dam-cdn.atl.orangelogic.com/AssetLink/6x7efvy8h46080717dj4ttoj24jxd15x.png
// Recipe:  public.screenshot_recipes where asset_id = '6x7efvy8h46080717dj4ttoj24jxd15x'
// Opens Space details of the SyncUp space (the lesson uses a Marketing space) and hovers the space icon. Nothing
// is clicked or saved. Owner, creator and admin names are fake names.

import { Page } from "@playwright/test";
import { runRecipe } from "../lib/recipe";
import { anonymize, fakeSignedInUser, FAKE_PEOPLE, renameOrg } from "../lib/tweaks";
import { dimAreas, editIconButton, fakePeopleLinks, openSpaceDetails } from "../lib/b3-conf";

const main = (page: Page) => page.locator("#AkMainContent");
const tooltip = (page: Page) => page.locator('[role="tooltip"]').filter({ hasText: /\S/ }).first();
const field = (page: Page, label: string) => main(page).getByText(label, { exact: true }).first();

runRecipe({
  file: "AUC-1402-1",
  assetId: "6x7efvy8h46080717dj4ttoj24jxd15x",
  title: "AUC-1402 #1 - Edit space icon on Space details",
  product: "confluence",

  async navigate(page, s) {
    await openSpaceDetails(page, s);
  },

  async tweak(page, s) {
    await renameOrg(page, s.test_org, s.display_org_name);
    await fakeSignedInUser(page, FAKE_PEOPLE[4]);
    await fakePeopleLinks(page);
    await anonymize(page, "ER", FAKE_PEOPLE);
    await editIconButton(page).hover();
    await tooltip(page).waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const area = [field(page, "Space icon"), editIconButton(page)];
    if (await tooltip(page).isVisible().catch(() => false)) area.push(tooltip(page));
    await dimAreas(page, [area]);
  },

  // The creation date and the admins' pictures depend on the space
  mask: (page) => [main(page).getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/).first()],

  async checks(page, c) {
    await c.check("Hovering the space icon shows 'Edit space icon'", async () => {
      const t = (await tooltip(page).innerText().catch(() => "")).trim();
      return { pass: t === "Edit space icon", detail: t ? `Tooltip: ${t}` : "No tooltip on hover" };
    });

    await c.check("Fields: Name, Space key, Owner, Admins, Created by", async () => {
      const missing = [];
      for (const f of ["Name", "Space key", "Owner", "Admins", "Created by"]) {
        if (!(await main(page).getByText(new RegExp(`^${f}\\s*\\*?$`)).first().isVisible().catch(() => false))) missing.push(f);
      }
      return { pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All present" };
    });

    await c.check("Admins shown with a View all link", async () => {
      const v = await main(page).getByRole("link", { name: "View all" }).or(main(page).getByRole("button", { name: "View all" })).first().isVisible().catch(() => false);
      return { pass: v, detail: v ? "View all present" : "No View all link next to Admins: SyncUp has one admin, the lesson's space five (test data)" };
    });

    await c.check("Space details selected in the sidebar", async () => {
      const cur = await page.locator("#side-navigation").getByRole("link", { name: "Space details", exact: true }).getAttribute("aria-current");
      return { pass: cur === "page", detail: `aria-current: ${cur}` };
    });
  },
});
