// Lesson:  AUC-330 — How do you administer an Atlassian organization?
//          https://community.atlassian.com/learning/lesson/how-do-you-administer-an-atlassian-organization
// Image:   #2, section "What is Atlassian Administration?"
//          https://dam-cdn.atl.orangelogic.com/AssetLink/5bph3ptlw74w0622n11j2040iotd1ao5.png
// Recipe:  public.screenshot_recipes where asset_id = '5bph3ptlw74w0622n11j2040iotd1ao5'

import { runRecipe, Blocked } from "../lib/recipe";
import { renameOrg, anonymize, hideMessages } from "../lib/tweaks";

const sidebar = '[data-testid="side-nav-view"]';

runRecipe({
  file: "AUC-330-2",
  assetId: "5bph3ptlw74w0622n11j2040iotd1ao5",
  title: "AUC-330 #2 — Atlassian Administration overview",

  async navigate(page, s) {
    // Step 1: open Atlassian Administration as an org admin
    await page.goto("https://admin.atlassian.com/");

    // Step 2: pick the test organization if the account administers several
    const orgLink = page.getByRole("link", { name: s.test_org, exact: true });
    if (await orgLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await orgLink.click();
    } else if (!(await page.locator(sidebar).isVisible().catch(() => false))) {
      throw new Blocked(`Organization "${s.test_org}" not found in the organization list`);
    }

    // Step 3: make sure Overview is open
    await page.locator(sidebar).waitFor();
    if (!/overview$/i.test(await page.locator("h1").innerText())) {
      await page.locator(sidebar).getByRole("link", { name: "Overview", exact: true }).click();
    }
    await page.locator("h1", { hasText: /overview$/i }).waitFor();
    await page.locator('[data-testid*="chart"] svg').first().waitFor(); // charts rendered
  },

  async tweak(page, s) {
    await hideMessages(page, ["We decluttered the left navigation"]);
    await renameOrg(page, s.test_org, s.display_org_name);
    await anonymize(page);
  },

  // Chart values and counts change daily; ignore them when comparing to the baseline
  mask: (page) => [page.locator('[data-testid*="chart"]')],

  async checks(page, c, s) {
    await c.check("Top bar labelled Administration, with a search box and an Invite users button", async () => {
      const label = await page.getByText("Administration", { exact: true }).first().isVisible();
      const search = await page.getByPlaceholder("Search").first().isVisible();
      // The top bar is the strip above the sidebar; Quick actions also has an Invite users button
      const inviteInTopBar = await page.getByRole("button", { name: "Invite users" }).evaluateAll((els) =>
        els.some((e) => e.getBoundingClientRect().top < 60),
      );
      const missing = [!label && "Administration label", !search && "search box", !inviteInTopBar && "Invite users button"].filter(Boolean);
      return { pass: missing.length === 0, detail: missing.length ? `Missing from top bar: ${missing.join(", ")}` : "Present" };
    });

    await c.check("Organization switcher at the top of the sidebar", async () => {
      const text = (await page.locator('[data-testid="org-selector-dropdown--trigger"]').innerText()).trim();
      return { pass: text === s.display_org_name, detail: `Shows "${text}"` };
    });

    await c.check("Sidebar items in this order: Overview, Directory, Apps, Security, Data management, Insights, Billing, Organization settings", async () => {
      const expected = ["Overview", "Directory", "Apps", "Security", "Data management", "Insights", "Billing", "Organization settings"];
      const actual = (await page.locator(`${sidebar} a, ${sidebar} button`).allInnerTexts())
        .map((t) => t.replace(/\s*New\s*$/, "").trim())
        .filter((t) => t && t !== s.display_org_name);
      const same = JSON.stringify(actual) === JSON.stringify(expected);
      const added = actual.filter((t) => !expected.includes(t));
      const removed = expected.filter((t) => !actual.includes(t));
      return {
        pass: same,
        detail: same ? "Same items, same order" : `Now: ${actual.join(", ")}. Added: ${added.join(", ") || "none"}. Removed or renamed: ${removed.join(", ") || "none"}.`,
      };
    });

    await c.check("Page title reads '<organization name> overview'", async () => {
      const h1 = (await page.locator("h1").innerText()).trim();
      return { pass: h1 === `${s.display_org_name} overview`, detail: `"${h1}"` };
    });

    await c.check("Quick actions: Invite users, Add app, Verify domain", async () => {
      const names = ["Invite users", "Add app", "Verify domain"];
      const missing: string[] = [];
      for (const n of names) if (!(await page.getByRole("button", { name: n, exact: true }).first().isVisible())) missing.push(n);
      return { pass: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All three present" };
    });

    await c.check("Monitor section with cards for Monthly active users, Requests for app access, and Users with access to your apps", async () => {
      const expected = ["Monthly active users", "Requests for app access", "Users with access to your apps"];
      const headings = (await page.locator("h2").allInnerTexts()).map((t) => t.trim());
      const missing = expected.filter((e) => !headings.some((h) => h.startsWith(e)));
      return {
        pass: missing.length === 0,
        detail: missing.length ? `Missing: ${missing.join(", ")}. Cards now: ${headings.filter((h) => /[a-z]/i.test(h)).join(" | ")}` : "All three cards present",
      };
    });

    await c.check("Discover section with promotional cards", async () => {
      const visible = await page.getByText("Discover", { exact: true }).first().isVisible();
      return { pass: visible, detail: visible ? "Present" : "Discover section not found" };
    });
  },
});
