import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./recipes",
  timeout: 120_000,
  workers: 3, // a few in parallel; Atlassian pages are heavy
  retries: 1, // one retry absorbs slow loads before anything is flagged
  reporter: [["list"], ["json", { outputFile: "results/report.json" }]],
  // Baselines = the last approved capture of each screenshot, kept in the repo
  snapshotPathTemplate: "baselines/{platform}/{arg}{ext}",
  use: {
    // Same size as the lesson images, so captures and baselines line up
    viewport: { width: 1321, height: 853 },
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    // Signed-in session for the test account (see README: npm run login)
    storageState: "auth/state.json",
  },
});
