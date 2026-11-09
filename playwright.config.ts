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
    // The page area of the lesson images: framed, they come out at the lesson size (1322x892)
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    // Signed-in session for the test account (see README: npm run login)
    storageState: "auth/state.json",
  },
});
